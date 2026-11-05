import { useState } from 'react'
import { AlertTriangle, ChevronDown, Check, CircleSlash, CircleDashed, Quote, ShieldCheck } from 'lucide-react'
import type { Assessment, Confidence, Score, SkillRow, SkillStatus } from '../../lib/types'
import { cn, confidenceLabel, scoreBand, scoreTone, type Tone } from '../../lib/utils'
import { Badge } from './core'

const toneText: Record<Tone, string> = {
  neutral: 'text-ink',
  accent: 'text-accent',
  good: 'text-good',
  warn: 'text-warn',
  bad: 'text-bad',
}

export function ScoreNumber({ score, size = 'md' }: { score: Score | null; size?: 'sm' | 'md' | 'lg' }) {
  if (!score) return <span className="text-sm text-faint">—</span>
  if (score.insufficient_evidence) {
    return (
      <span className={cn('inline-flex items-center gap-1.5 rounded-md border border-line bg-elevated/60 px-2 py-1 font-medium text-muted', size === 'sm' ? 'text-micro' : 'text-xs')}>
        <AlertTriangle className="h-3 w-3" /> Evidence thin
      </span>
    )
  }
  const tone = scoreTone(score.overall)
  return (
    <span className={cn('font-semibold tracking-tight tnum', toneText[tone], size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-3xl' : 'text-xl')}>
      {Math.round(score.overall)}
      <span className="ml-0.5 text-xs font-normal text-faint">/100</span>
    </span>
  )
}

export function ConfidenceBand({ confidence, insufficient }: { confidence: Confidence; insufficient?: boolean }) {
  const tone: Tone = confidence === 'high' ? 'good' : confidence === 'medium' ? 'warn' : 'bad'
  const bars = confidence === 'high' ? 3 : confidence === 'medium' ? 2 : 1
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5" title={insufficient ? 'Too little verified evidence for a confident score' : undefined}>
      <span className="flex items-end gap-0.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn(
              'w-1 rounded-sm transition-colors',
              i === 0 ? 'h-1.5' : i === 1 ? 'h-2.5' : 'h-3.5',
              i < bars
                ? tone === 'good'
                  ? 'bg-good'
                  : tone === 'warn'
                    ? 'bg-warn'
                    : 'bg-bad'
                : 'bg-line',
            )}
          />
        ))}
      </span>
      <span className="text-micro text-muted">{confidenceLabel(confidence)}</span>
    </span>
  )
}

const DIMENSIONS = [
  { key: 'skills', label: 'Skills', weight: 50 },
  { key: 'experience', label: 'Experience', weight: 25 },
  { key: 'projects', label: 'Project relevance', weight: 15 },
  { key: 'qualifications', label: 'Qualifications', weight: 10 },
] as const

export function ScoreBreakdown({ score, compact }: { score: Score; compact?: boolean }) {
  return (
    <div className={cn('space-y-2.5', compact && 'space-y-2')}>
      {DIMENSIONS.map((d) => {
        const value = Math.round(score[d.key])
        const tone = scoreTone(value)
        return (
          <div key={d.key}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs text-muted">
                {d.label}
                <span className="ml-1.5 text-micro text-faint">{d.weight}%</span>
              </span>
              <span className="text-xs font-medium text-ink tnum">{value}</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-elevated" role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={`${d.label} score`}>
              <div
                className={cn('h-full rounded-full transition-[width] duration-500', tone === 'good' ? 'bg-good' : tone === 'warn' ? 'bg-warn' : 'bg-bad')}
                style={{ width: `${Math.max(2, value)}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function ModeBadges({ score }: { score: Score }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge tone={score.ai_mode === 'groq' ? 'accent' : 'warn'} dot>
        {score.ai_mode === 'groq' ? 'LLM extraction' : score.ai_mode === 'heuristic' ? 'Heuristic fallback' : 'Degraded AI'}
      </Badge>
      <Badge tone={score.embedding_mode === 'dense' ? 'neutral' : 'warn'} dot>
        {score.embedding_mode === 'dense' ? 'Dense embeddings' : 'Lexical similarity'}
      </Badge>
      <ConfidenceBand confidence={score.confidence} insufficient={score.insufficient_evidence} />
    </div>
  )
}

const STATUS_META: Record<SkillStatus, { label: string; tone: Tone; icon: typeof Check }> = {
  matched: { label: 'Matched', tone: 'good', icon: Check },
  partial: { label: 'Partial', tone: 'warn', icon: CircleDashed },
  not_evidenced: { label: 'Missing evidence', tone: 'neutral', icon: CircleSlash },
  confirmed_absent: { label: 'Confirmed absent', tone: 'bad', icon: CircleSlash },
}

export function SkillStatusPill({ status, support }: { status: SkillStatus; support?: string }) {
  const meta = STATUS_META[status]
  const Icon = meta.icon
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Badge tone={meta.tone}>
        <Icon className="h-3 w-3" aria-hidden />
        {meta.label}
      </Badge>
      {support === 'flagged_unverified' && (
        <Badge tone="bad">
          <AlertTriangle className="h-3 w-3" aria-hidden /> Unverified
        </Badge>
      )}
    </span>
  )
}

export function EvidenceQuote({ quote, label, similarity, support }: { quote: string; label?: string; similarity?: number | null; support?: string }) {
  return (
    <figure className="border-l-2 border-accent/50 pl-3">
      <blockquote className="text-xs leading-relaxed text-ink/90">
        <Quote className="mr-1 inline h-3 w-3 text-accent/70" aria-hidden />
        {quote}
      </blockquote>
      <figcaption className="mt-1 flex flex-wrap items-center gap-2 text-micro text-faint">
        {label && <span>{label}</span>}
        {typeof similarity === 'number' && (
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" /> similarity {Math.round(similarity * 100)}%
          </span>
        )}
        {support === 'flagged_unverified' && <span className="text-bad">quote not found in resume — needs review</span>}
        <span className="text-faint/80">verified against resume text</span>
      </figcaption>
    </figure>
  )
}

export function SkillMatrix({ skills, showEvidence = true }: { skills: SkillRow[]; showEvidence?: boolean }) {
  const [open, setOpen] = useState<number | null>(skills.find((s) => s.evidence)?.requirement_id ?? null)

  return (
    <div className="divide-y divide-line">
      {skills.map((s) => {
        const hasEvidence = Boolean(s.evidence)
        const expanded = showEvidence && open === s.requirement_id
        const meta = STATUS_META[s.status]
        return (
          <div key={s.requirement_id} className="px-4 py-2.5">
            <button
              type="button"
              className={cn('flex w-full items-center gap-3 text-left', hasEvidence ? 'cursor-pointer' : 'cursor-default')}
              onClick={() => hasEvidence && setOpen(expanded ? null : s.requirement_id)}
              aria-expanded={hasEvidence ? expanded : undefined}
              disabled={!hasEvidence}
            >
              <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', s.status === 'matched' ? 'bg-good' : s.status === 'partial' ? 'bg-warn' : s.status === 'confirmed_absent' ? 'bg-bad' : 'bg-line')} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-ink">{s.label}</span>
                  {s.importance === 'preferred' && <span className="text-micro text-faint">preferred</span>}
                  {s.support === 'flagged_unverified' && <AlertTriangle className="h-3 w-3 text-bad" aria-label="Unverified evidence" />}
                </span>
                {s.reason && !expanded && <span className="mt-0.5 block truncate text-micro text-faint">{s.reason}</span>}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <Badge tone={meta.tone} className="hidden sm:inline-flex">
                  {meta.label}
                </Badge>
                {typeof s.similarity === 'number' && <span className="hidden text-micro text-faint tnum md:inline">{Math.round(s.similarity * 100)}%</span>}
                {hasEvidence && <ChevronDown className={cn('h-3.5 w-3.5 text-faint transition-transform duration-150', expanded && 'rotate-180')} aria-hidden />}
              </span>
            </button>
            {expanded && s.evidence && (
              <div className="mt-2.5 space-y-2 pl-4 animate-fade-in">
                <EvidenceQuote quote={s.evidence.quote} similarity={s.similarity} support={s.support} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function AssessmentSummary({ assessment }: { assessment: Assessment }) {
  return (
    <div className="space-y-3 px-4 py-3">
      <p className="text-xs leading-relaxed text-muted">{assessment.summary ?? assessment.explanation}</p>
      <ModeBadges score={assessment} />
    </div>
  )
}

export function scoreBandLabel(score: Score | null) {
  if (!score) return 'Not assessed'
  if (score.insufficient_evidence) return 'Insufficient evidence'
  return scoreBand(score.overall)
}
