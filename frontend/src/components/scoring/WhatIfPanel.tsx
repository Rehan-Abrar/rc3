import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Info, Minus, Play, Save, ShieldCheck, Undo2 } from 'lucide-react'
import { scoring as scoringApi } from '../../lib/api'
import type { Weights, WhatIfResult, WhatIfRow } from '../../lib/types'
import { cn } from '../../lib/utils'
import { Badge, Button, Card, CardHeader, Dialog, ErrorState, Skeleton } from '../ui/core'
import { useToast } from '../ui/toast'
import { DEFAULT_WEIGHTS, WeightsEditor, sameWeights, totalOf } from './WeightsEditor'

const DIM_LABEL: Record<string, string> = {
  skills: 'Skills',
  experience: 'Experience',
  projects: 'Projects',
  qualifications: 'Qualifications',
}

/** Only the dimensions that actually moved the score, biggest first. */
function drivers(row: WhatIfRow) {
  const entries = Object.entries(row.contributions ?? {}) as Array<[string, number]>
  return entries
    .filter(([, value]) => Math.abs(value) >= 0.05)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 2)
}

function Movement({ row }: { row: WhatIfRow }) {
  if (row.simulated_score == null) return <span className="text-micro text-faint">not scored</span>
  const move = row.movement ?? 0
  if (move === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-micro text-muted">
        <Minus className="h-3 w-3" aria-hidden /> unchanged
      </span>
    )
  }
  const up = move > 0
  return (
    <span className={cn('inline-flex items-center gap-1 text-micro font-medium', up ? 'text-good' : 'text-bad')}>
      {up ? <ArrowUp className="h-3 w-3" aria-hidden /> : <ArrowDown className="h-3 w-3" aria-hidden />}
      {up ? '+' : ''}
      {move} {up ? 'up' : 'down'}
    </span>
  )
}

/**
 * What-If Ranking Simulator.
 *
 * Everything here is a preview: the server ranks the real stored dimension scores and writes
 * nothing. Saving is a separate, explicitly confirmed action, and it is the only thing that
 * changes official scores.
 */
export function WhatIfPanel({
  jobId,
  savedWeights,
  onSaved,
  defaultOpen = false,
}: {
  jobId: number
  savedWeights: Weights
  onSaved?: () => void
  defaultOpen?: boolean
}) {
  const { push } = useToast()
  const [open, setOpen] = useState(defaultOpen)
  const [weights, setWeights] = useState<Weights>(savedWeights)
  const [result, setResult] = useState<WhatIfResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [reason, setReason] = useState('')

  useEffect(() => {
    setWeights(savedWeights)
    // A saved change invalidates the preview: it was computed against the old baseline.
    setResult(null)
  }, [savedWeights.skills, savedWeights.experience, savedWeights.projects, savedWeights.qualifications])

  const dirty = !sameWeights(weights, savedWeights)
  const valid = Math.abs(totalOf(weights) - 100) < 0.001

  const preview = useCallback(async () => {
    if (!valid) return
    setLoading(true)
    setError(null)
    try {
      setResult(await scoringApi.whatIf(jobId, weights))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not simulate these weights.')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }, [jobId, weights, valid])

  // Debounced auto-preview while dragging, so the slider feels live without hammering the API.
  useEffect(() => {
    if (!open || !valid) return
    const timer = setTimeout(() => void preview(), 260)
    return () => clearTimeout(timer)
  }, [open, valid, preview])

  const apply = async () => {
    setSaving(true)
    try {
      await scoringApi.apply(jobId, weights, reason.trim() || undefined)
      push('Weights saved. Official scores and rankings were recalculated from the stored evidence.')
      setConfirming(false)
      setReason('')
      onSaved?.()
    } catch (e) {
      push(e instanceof Error ? e.message : 'Could not save the weights.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const rows = result?.rows ?? []
  const changed = useMemo(
    () => rows.filter((r) => r.current_score != null && r.simulated_score != null &&
      Math.abs((r.simulated_score ?? 0) - (r.current_score ?? 0)) >= 0.05),
    [rows],
  )

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            What-if ranking
            <Badge tone="accent">preview only</Badge>
          </span>
        }
        subtitle="Change the weights and see how this job's rankings would move. Nothing is saved until you apply it."
        actions={
          <Button size="sm" variant={open ? 'ghost' : 'primary'} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {open ? 'Hide' : 'Adjust weights'}
          </Button>
        }
      />

      {open && (
        <div className="grid gap-0 border-t border-line lg:grid-cols-[300px_1fr]">
          <div className="border-b border-line p-4 lg:border-b-0 lg:border-r">
            <WeightsEditor value={weights} onChange={setWeights} disabled={loading || saving} showPresets showHints={false} idPrefix={`whatif-${jobId}`} />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="primary" onClick={preview} loading={loading} disabled={!valid || !dirty && Boolean(result)}>
                <Play className="h-3.5 w-3.5" /> Preview
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setWeights({ ...savedWeights }); setResult(null) }} disabled={!dirty}>
                <Undo2 className="h-3.5 w-3.5" /> Saved weights
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setWeights({ ...DEFAULT_WEIGHTS }); setResult(null) }} disabled={sameWeights(weights, DEFAULT_WEIGHTS)}>
                Default
              </Button>
              <Button size="sm" onClick={() => setConfirming(true)} disabled={!dirty || !valid || !result}>
                <Save className="h-3.5 w-3.5" /> Apply
              </Button>
            </div>
            {dirty && (
              <p className="mt-2 text-[11px] text-warn">
                Unsaved preview. Official rankings are unchanged until you apply.
              </p>
            )}
            {!dirty && result && (
              <p className="mt-2 text-[11px] text-faint">These are the weights this job is scored with right now.</p>
            )}
          </div>

          <div className="min-w-0">
            {error && <div className="p-4"><ErrorState message={error} onRetry={preview} /></div>}
            {!result && !error && (loading ? <div className="space-y-2 p-4"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div> : (
              <div className="p-4">
                <p className="text-xs text-muted">
                  Move a weight and a preview appears here, ranked against the same stored assessments the
                  official list uses.
                </p>
              </div>
            ))}

            {result && (
              <div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-4 py-2">
                  <span className="text-micro text-muted">
                    <span className="font-mono text-ink tnum">{changed.length}</span> of {rows.length} scores moved
                  </span>
                  <span className="text-micro text-good">{result.moved_up} up</span>
                  <span className="text-micro text-bad">{result.moved_down} down</span>
                  {result.incomplete > 0 && (
                    <span className="text-micro text-warn">{result.incomplete} without a usable assessment</span>
                  )}
                  <span className="ml-auto inline-flex items-center gap-1 text-micro text-faint">
                    <ShieldCheck className="h-3 w-3" aria-hidden /> no writes, no AI calls
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[540px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-line text-left">
                        <th className="px-4 py-1.5 text-micro font-medium uppercase tracking-wider text-faint">Candidate</th>
                        <th className="px-2 py-1.5 text-right text-micro font-medium uppercase tracking-wider text-faint">Now</th>
                        <th className="px-2 py-1.5 text-right text-micro font-medium uppercase tracking-wider text-faint">Simulated</th>
                        <th className="px-2 py-1.5 text-right text-micro font-medium uppercase tracking-wider text-faint">Rank</th>
                        <th className="px-2 py-1.5 text-micro font-medium uppercase tracking-wider text-faint">Move</th>
                        <th className="px-4 py-1.5 text-micro font-medium uppercase tracking-wider text-faint">Drivers</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => {
                        const delta = (row.simulated_score ?? 0) - (row.current_score ?? 0)
                        return (
                          <tr key={row.application_id} className="border-b border-line/70 last:border-0 row-hover">
                            <td className="max-w-[180px] truncate px-4 py-2 text-[13px] text-ink">
                              {row.candidate?.name ?? 'Candidate'}
                              {row.override_score != null && (
                                <span className="ml-1.5 border border-warn/40 bg-warn/5 px-1 py-0.5 text-[9px] uppercase tracking-wider text-warn">
                                  override
                                </span>
                              )}
                              {row.simulated_score == null && (
                                <span className="ml-1.5 text-[9px] uppercase tracking-wider text-faint">no assessment</span>
                              )}
                            </td>
                            <td className="px-2 py-2 text-right font-mono text-[13px] text-muted tnum">
                              {row.current_score == null ? '—' : Math.round(row.current_score)}
                            </td>
                            <td className="px-2 py-2 text-right font-mono text-[13px] font-medium text-ink tnum">
                              {row.simulated_score == null ? '—' : Math.round(row.simulated_score)}
                              {row.simulated_score != null && Math.abs(delta) >= 0.05 && (
                                <span className={cn('ml-1 text-[10px]', delta > 0 ? 'text-good' : 'text-bad')}>
                                  {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-2 text-right font-mono text-[11px] text-muted tnum">
                              {row.current_rank ?? '—'} <span className="text-faint">→</span> {row.simulated_rank ?? '—'}
                            </td>
                            <td className="px-2 py-2"><Movement row={row} /></td>
                            <td className="px-4 py-2">
                              <div className="flex flex-wrap gap-1">
                                {drivers(row).map(([key, value]) => (
                                  <span
                                    key={key}
                                    className={cn('border px-1 py-0.5 text-[10px]',
                                      value > 0 ? 'border-good/30 bg-good/5 text-good' : 'border-bad/30 bg-bad/5 text-bad')}
                                    title={`${DIM_LABEL[key]} contributes ${value > 0 ? '+' : ''}${value} points`}
                                  >
                                    {DIM_LABEL[key]} {value > 0 ? '+' : ''}{value}
                                  </span>
                                ))}
                                {drivers(row).length === 0 && <span className="text-[10px] text-faint">—</span>}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                      {rows.length === 0 && (
                        <tr><td colSpan={6} className="px-4 py-4 text-xs text-faint">No applications on this job yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-start gap-x-4 gap-y-1 border-t border-line px-4 py-2 text-[11px] text-faint">
                  <span className="inline-flex items-center gap-1">
                    <Info className="h-3 w-3" aria-hidden />
                    Effective: {Object.entries(result.effective_weights ?? {})
                      .filter(([, v]) => (v as number) > 0)
                      .map(([k, v]) => `${DIM_LABEL[k]} ${Math.round((v as number) * 100)}%`)
                      .join(' · ') || '—'}
                  </span>
                  <span>{result.note}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Apply these weights to this job?"
        description="Scores are recalculated from the stored evidence - no re-assessment, no new AI calls. Candidate stages, notes and interview decisions are not touched, and the change is recorded in the audit history."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
            <Button variant="primary" onClick={apply} loading={saving}>
              <Save className="h-3.5 w-3.5" /> Save weights
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            {(['skills', 'experience', 'projects', 'qualifications'] as const).map((key) => (
              <div key={key} className="flex items-center justify-between border border-line bg-canvas px-2 py-1">
                <span className="text-muted">{DIM_LABEL[key]}</span>
                <span className="font-mono text-ink tnum">
                  <span className="text-faint">{savedWeights[key]}%</span> → {weights[key]}%
                </span>
              </div>
            ))}
          </div>
          <label className="block">
            <span className="label">Reason (optional, kept in the audit history)</span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={200}
              placeholder="e.g. Senior role: experience should outweigh project count"
              className="field"
            />
          </label>
        </div>
      </Dialog>
    </Card>
  )
}
