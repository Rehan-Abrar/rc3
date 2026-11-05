/**
 * API types come from `contracts/types.ts` (owned by Agent B, read-only).
 * Only frontend-local request/response helpers live here.
 */
export * from '../../../contracts/types'

import type { JobSummary, Score, SkillRow, Stage, Weights } from '../../../contracts/types'

/** Request body for create/edit — the API returns a JobDetail. */
export interface JobInput {
  title: string
  department?: string | null
  location?: string | null
  employment_type?: string | null
  salary_min?: number | null
  salary_max?: number | null
  description: string
  requirements: Array<{
    label: string
    kind?: 'skill' | 'qualification'
    importance: 'required' | 'preferred'
    weight?: number
    min_years?: number | null
    evidence_hint?: string | null
  }>
  /** Optional: omit to keep the job's current weights (or the 50/25/15/10 default). */
  weights?: Weights
}

/** GET /talent/compare?ids=1,2 — job plus one aligned row per candidate. */
export interface CompareResponse {
  job: JobSummary
  rows: CompareRow[]
}

export interface CompareRow {
  candidate_id: number
  name: string
  score: Score | null
  matched: SkillRow[]
  missing: SkillRow[]
  gaps: string[]
}

/** GET /candidates/jobs/recommended (shape mirrors the API response) */
export interface RecommendedJob {
  job_id: number
  title: string
  department: string
  similarity: number
  score: number
  matched_skills: string[]
  reason: string
}

/** UI-only view model: an application row plus its lazily loaded assessment. */
export interface ApplicantView {
  application_id: number
  job_id: number
  stage: Stage
  candidate: { id: number; name: string; email: string }
  resume_id: number
  resume_filename: string
  score: Score | null
  matched: string[]
  missing: string[]
  has_notes: boolean
  override_score?: number | null
  override_reason?: string | null
  applied_at?: string
}
