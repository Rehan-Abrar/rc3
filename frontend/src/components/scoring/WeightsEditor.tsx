import { useMemo } from 'react'
import { RotateCcw } from 'lucide-react'
import type { Weights, WeightKey } from '../../lib/types'
import { cn } from '../../lib/utils'
import { Badge, Button } from '../ui/core'

export const DIMENSIONS: Array<{ key: WeightKey; label: string; hint: string }> = [
  { key: 'skills', label: 'Skills', hint: 'Evidence that the required skills, tools and stack are present.' },
  { key: 'experience', label: 'Experience', hint: 'Years and seniority the role asks for. Only weighed when the job sets a bar.' },
  { key: 'projects', label: 'Project relevance', hint: 'How close the candidate\u2019s own projects are to this role\u2019s work.' },
  { key: 'qualifications', label: 'Qualifications', hint: 'Degrees and certifications the job lists as requirements.' },
]

export const DEFAULT_WEIGHTS: Weights = { skills: 50, experience: 25, projects: 15, qualifications: 10 }

export const PRESETS: Array<{ id: string; label: string; note: string; weights: Weights }> = [
  { id: 'default', label: 'Balanced', note: '50 / 25 / 15 / 10', weights: DEFAULT_WEIGHTS },
  { id: 'skills', label: 'Skills-first', note: '65 / 15 / 15 / 5', weights: { skills: 65, experience: 15, projects: 15, qualifications: 5 } },
  { id: 'senior', label: 'Senior role', note: '30 / 45 / 15 / 10', weights: { skills: 30, experience: 45, projects: 15, qualifications: 10 } },
  { id: 'portfolio', label: 'Portfolio-first', note: '35 / 10 / 45 / 10', weights: { skills: 35, experience: 10, projects: 45, qualifications: 10 } },
]

export const totalOf = (w: Weights) =>
  Math.round((w.skills + w.experience + w.projects + w.qualifications) * 100) / 100

export const sameWeights = (a: Weights, b: Weights) =>
  DIMENSIONS.every((d) => Math.abs((a?.[d.key] ?? 0) - (b?.[d.key] ?? 0)) < 0.001)

/** Nudge a dimension so the four always sum to 100, keeping every value inside 0..100. */
export function rebalance(weights: Weights, key: WeightKey, rawValue: number): Weights {
  const value = Math.max(0, Math.min(100, Math.round(rawValue)))
  const others = DIMENSIONS.filter((d) => d.key !== key)
  const rest = 100 - value
  const otherTotal = others.reduce((sum, d) => sum + weights[d.key], 0)
  const next: Weights = { ...weights, [key]: value }
  if (otherTotal === 0) {
    // Nothing to scale: spread the remainder evenly so the total is always valid.
    others.forEach((d, i) => {
      next[d.key] = i === 0 ? rest - Math.floor(rest / others.length) * (others.length - 1) : Math.floor(rest / others.length)
    })
    return next
  }
  let assigned = 0
  others.forEach((d, i) => {
    if (i === others.length - 1) {
      next[d.key] = Math.max(0, Math.min(100, rest - assigned))
      return
    }
    const share = Math.round((weights[d.key] / otherTotal) * rest)
    next[d.key] = Math.max(0, Math.min(100, share))
    assigned += next[d.key]
  })
  return next
}

/**
 * The four weight sliders. Pure controlled component: it never saves anything, so both the job
 * editor (saved with the job) and the What-If panel (preview only) can reuse it.
 */
export function WeightsEditor({
  value,
  onChange,
  disabled,
  showPresets = true,
  showHints = true,
  idPrefix = 'weights',
}: {
  value: Weights
  onChange: (next: Weights) => void
  disabled?: boolean
  showPresets?: boolean
  showHints?: boolean
  idPrefix?: string
}) {
  const total = useMemo(() => totalOf(value), [value])
  const valid = Math.abs(total - 100) < 0.001

  return (
    <div className="space-y-3">
      {showPresets && (
        <div className="grid grid-cols-2 gap-1.5">
          <span className="bracket col-span-2">presets</span>
          {PRESETS.map((p) => {
            const active = sameWeights(p.weights, value)
            return (
              <button
                key={p.id}
                type="button"
                disabled={disabled}
                onClick={() => onChange({ ...p.weights })}
                aria-pressed={active}
                className={cn(
                  'chip w-full justify-between transition-colors disabled:opacity-50',
                  active
                    ? 'border-accent bg-accent text-white'
                    : 'border-line bg-surface text-muted hover:border-accent/40 hover:text-ink',
                )}
              >
                {p.label}
                <span className={cn('font-normal', active ? 'text-white/70' : 'text-faint')}>{p.note}</span>
              </button>
            )
          })}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={disabled}
            className="col-span-2 h-7 justify-start px-2 text-micro text-muted"
            onClick={() => onChange({ ...DEFAULT_WEIGHTS })}
          >
            <RotateCcw className="h-3 w-3" /> Reset to 50 / 25 / 15 / 10
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {DIMENSIONS.map((d, index) => {
          const id = `${idPrefix}-${d.key}`
          const percent = value[d.key]
          return (
            <div key={d.key}>
              <div className="flex items-baseline justify-between gap-2">
                <label htmlFor={id} className="text-xs font-medium text-ink">
                  <span className="mr-1.5 font-mono text-[10px] text-faint">{String(index + 1).padStart(2, '0')}</span>
                  {d.label}
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    aria-label={`${d.label} weight percent`}
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={percent}
                    disabled={disabled}
                    onChange={(e) => onChange(rebalance(value, d.key, Number(e.target.value)))}
                    className="field h-7 w-16 px-1.5 text-right text-xs tnum"
                  />
                  <span className="text-xs text-faint" aria-hidden>%</span>
                </div>
              </div>
              <input
                id={id}
                type="range"
                min={0}
                max={100}
                step={1}
                value={percent}
                disabled={disabled}
                aria-valuetext={`${percent} percent`}
                onChange={(e) => onChange(rebalance(value, d.key, Number(e.target.value)))}
                className="mt-1.5 h-1.5 w-full cursor-pointer appearance-none bg-elevated accent-accent disabled:cursor-not-allowed"
                style={{
                  background: `linear-gradient(to right, rgb(var(--accent)) ${percent}%, rgb(var(--elevated)) ${percent}%)`,
                }}
              />
              {showHints && <p className="mt-1 text-[11px] leading-snug text-faint">{d.hint}</p>}
            </div>
          )
        })}
      </div>

      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-2 border px-2.5 py-2',
          valid ? 'border-line bg-canvas' : 'border-bad/40 bg-bad/5',
        )}
      >
        <span className="text-xs text-muted">
          Total
          <span className={cn('ml-1.5 font-mono tnum', valid ? 'text-ink' : 'text-bad')}>{total}%</span>
        </span>
        {valid ? (
          <Badge tone="good">Sums to 100</Badge>
        ) : (
          <Badge tone="bad">
            {total > 100 ? `${Math.round((total - 100) * 100) / 100} too high` : `${Math.round((100 - total) * 100) / 100} short`}
          </Badge>
        )}
      </div>
      <p className="text-[11px] leading-snug text-faint">
        Weights are applied to the stored dimension scores. A dimension this job does not measure
        (for example experience when no requirement sets a minimum) is excluded and its weight is
        redistributed proportionally - it is never counted as a zero.
      </p>
    </div>
  )
}
