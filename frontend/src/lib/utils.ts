import { clsx, type ClassValue } from 'clsx'
import type { Confidence, JobStatus, Stage } from './types'

export const cn = (...inputs: ClassValue[]) => clsx(inputs)

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')

export const formatDate = (iso: string | null | undefined, withTime = false) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}

export const formatRelative = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  return formatDate(iso)
}

export const formatSalary = (min: number | null, max: number | null) => {
  if (!min && !max) return 'Salary not disclosed'
  const f = (n: number) => `€${Math.round(n / 1000)}k`
  if (min && max) return `${f(min)} – ${f(max)}`
  return min ? `From ${f(min)}` : `Up to ${f(max!)}`
}

export const STAGE_LABEL: Record<Stage, string> = {
  submitted: 'Submitted',
  parsed: 'Parsed',
  assessed: 'AI assessed',
  recruiter_review: 'In review',
  shortlisted: 'Shortlisted',
  interview: 'Interview',
  selected: 'Selected',
  rejected: 'Rejected',
}

export const STAGE_ORDER: Stage[] = [
  'submitted',
  'parsed',
  'assessed',
  'recruiter_review',
  'shortlisted',
  'interview',
  'selected',
  'rejected',
]

export type Tone = 'neutral' | 'accent' | 'good' | 'warn' | 'bad'

export const stageTone = (stage: Stage): Tone => {
  if (stage === 'shortlisted' || stage === 'selected') return 'good'
  if (stage === 'interview') return 'accent'
  if (stage === 'rejected') return 'bad'
  if (stage === 'recruiter_review') return 'warn'
  return 'neutral'
}

export const scoreTone = (overall: number): Tone => {
  if (overall >= 75) return 'good'
  if (overall >= 55) return 'warn'
  return 'bad'
}

export const scoreBand = (overall: number) => {
  if (overall >= 75) return 'Strong match'
  if (overall >= 55) return 'Partial match'
  return 'Weak match'
}

export const confidenceLabel = (c: Confidence) =>
  c === 'high' ? 'High confidence' : c === 'medium' ? 'Medium confidence' : 'Low confidence'

export const jobStatusTone = (s: JobStatus): Tone => (s === 'open' ? 'good' : 'neutral')

export const bytes = (n: number) => (n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.round(n / 1000)} KB`)

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
