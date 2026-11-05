/**
 * Fixture aggregator + in-memory store. The UI reads through `lib/api.ts` only.
 * Shapes follow `contracts/types.ts` exactly so fixture mode and live mode are
 * interchangeable.
 */
import type {
  AnalyticsOverview,
  Application,
  ApplicationDetail,
  Interview,
  InterviewQuestion,
  JobDetail,
  JobSummary,
  Note,
  StatusEvent,
  User,
} from './types'
import { iso, jobs, jobRequirements, users, type RequirementRow } from './fixtures.base'
import { ASSESSMENTS, resumes } from './fixtures.assessments'
import type { ApplicantView } from './types'

export const store = {
  users,
  jobs: [...jobs],
  requirements: [...jobRequirements] as RequirementRow[],
  resumes,
  applications: [] as Application[],
  events: [] as StatusEvent[],
  notes: [] as Note[],
  questions: [] as InterviewQuestion[],
  interviews: [] as Interview[],
  nextId: 1000,
}

store.applications = [
  { id: 1, job_id: 1, candidate_id: 2, resume_id: 1, stage: 'shortlisted', created_at: iso(2, 14), updated_at: iso(0, 9), override_score: 96, override_reason: 'Strong leadership signal from project ownership' },
  { id: 2, job_id: 1, candidate_id: 3, resume_id: 2, stage: 'recruiter_review', created_at: iso(2, 13), updated_at: iso(1, 10), override_score: null, override_reason: null },
  { id: 3, job_id: 1, candidate_id: 4, resume_id: 3, stage: 'assessed', created_at: iso(2, 12), updated_at: iso(1, 15), override_score: null, override_reason: null },
  { id: 4, job_id: 1, candidate_id: 5, resume_id: 4, stage: 'parsed', created_at: iso(1, 16), updated_at: iso(1, 16), override_score: null, override_reason: null },
  { id: 5, job_id: 2, candidate_id: 2, resume_id: 5, stage: 'submitted', created_at: iso(1, 11), updated_at: iso(1, 11), override_score: null, override_reason: null },
  { id: 6, job_id: 2, candidate_id: 4, resume_id: 3, stage: 'assessed', created_at: iso(1, 9), updated_at: iso(1, 11), override_score: null, override_reason: null },
]

const event = (appId: number, from: Application['stage'] | null, to: Application['stage'], reason: string | null, daysAgo: number, hour = 9): StatusEvent => ({
  id: 1000 + appId * 10 + (from ? from.length : 0),
  application_id: appId,
  actor_id: 1,
  actor_name: 'Nadia Rahman',
  from_stage: from,
  to_stage: to,
  reason,
  created_at: iso(daysAgo, hour),
})

store.events = [
  event(1, null, 'submitted', null, 2, 14),
  event(1, 'submitted', 'parsed', null, 2, 14),
  event(1, 'parsed', 'assessed', null, 2, 14),
  event(1, 'assessed', 'recruiter_review', null, 2, 15),
  event(1, 'recruiter_review', 'shortlisted', 'Clear match on all four required skills with strong evidence', 0, 9),
  event(2, null, 'submitted', null, 2, 13),
  event(2, 'submitted', 'parsed', null, 2, 13),
  event(2, 'parsed', 'assessed', null, 2, 14),
  event(2, 'assessed', 'recruiter_review', null, 1, 10),
  event(3, null, 'submitted', null, 2, 12),
  event(3, 'submitted', 'parsed', null, 2, 12),
  event(3, 'parsed', 'assessed', null, 1, 15),
  event(4, null, 'submitted', null, 1, 16),
  event(4, 'submitted', 'parsed', null, 1, 16),
]

store.notes = [
  {
    id: 1,
    application_id: 1,
    author_name: 'Nadia Rahman',
    body: 'Strong fit. The PostgreSQL migration story and Django scale are exactly what the platform team needs. Flagged for a technical screen this week.',
    created_at: iso(0, 9, 30),
  },
]

store.questions = [
  { id: 1, application_id: 1, text: 'Explain how you would design a Django REST endpoint that must stay idempotent under retries.', difficulty: 'intermediate', category: 'skill', guideline: 'Listen for idempotency keys, unique constraints and how the database handles duplicate requests. Good answers mention transactions and Postgres advisory locks.', source: 'ai', created_at: iso(0, 10) },
  { id: 2, application_id: 1, text: 'You led a migration from MySQL to PostgreSQL with zero downtime. Walk through the replication strategy you would use.', difficulty: 'advanced', category: 'project', guideline: 'Assess understanding of logical replication, dual-write periods and cutover. A structured answer with rollback planning is a strong signal.', source: 'ai', created_at: iso(0, 10) },
  { id: 3, application_id: 1, text: 'What does the Django ORM generate for a JOIN across a foreign key, and how would you inspect the generated SQL?', difficulty: 'beginner', category: 'skill', guideline: 'Expected: .query, connection.queries or EXPLAIN. Reward awareness of N+1 queries and select_related.', source: 'ai', created_at: iso(0, 10) },
  { id: 4, application_id: 1, text: 'Describe a time a production API degraded under load. What did you measure and what did you change?', difficulty: 'intermediate', category: 'behavioral', guideline: 'Look for a specific incident, concrete metrics, and a change that was measured afterwards.', source: 'ai', created_at: iso(0, 10) },
  { id: 5, application_id: 1, text: 'Your Ledger Service uses Redis-backed locks. When can a Redis lock fail, and how would you make the write truly idempotent?', difficulty: 'advanced', category: 'project', guideline: 'Reward discussion of lock expiry, fencing tokens, and a database constraint as the source of truth.', source: 'ai', created_at: iso(0, 10) },
  { id: 6, application_id: 1, text: 'How would you containerise a Django app so local development and CI stay in parity?', difficulty: 'beginner', category: 'skill', guideline: 'Look for multi-stage builds, pinned base images, and a docker-compose for services like Postgres.', source: 'ai', created_at: iso(0, 10) },
]

store.interviews = [
  {
    id: 1,
    application_id: 1,
    candidate_name: 'Ayesha Khan',
    job_title: 'Backend Developer',
    scheduled_at: '2026-11-08T10:00:00Z',
    duration_min: 60,
    interviewer_id: 1,
    interviewer_name: 'Nadia Rahman',
    interview_type: 'technical',
    location: 'Google Meet',
    status: 'scheduled',
    conflict_flag: false,
  },
]

export const jobSummaries = (): JobSummary[] =>
  store.jobs.map((j) => {
    const apps = store.applications.filter((a) => a.job_id === j.id)
    return {
      id: j.id,
      title: j.title,
      department: j.department ?? '',
      location: j.location ?? '',
      employment_type: j.employment_type ?? '',
      salary_min: j.salary_min,
      salary_max: j.salary_max,
      status: j.status,
      created_at: j.created_at,
      updated_at: j.updated_at,
      applicant_count: apps.length,
      shortlisted_count: apps.filter((a) => a.stage === 'shortlisted' || a.stage === 'interview' || a.stage === 'selected').length,
      interview_count: store.interviews.filter((i) => apps.some((a) => a.id === i.application_id)).length,
    }
  })

export const jobDetail = (id: number): JobDetail | null => {
  const job = store.jobs.find((j) => j.id === id)
  const sum = jobSummaries().find((j) => j.id === id)
  if (!job || !sum) return null
  return {
    ...sum,
    description: job.description,
    recruiter_id: job.recruiter_id,
    requirements: store.requirements.filter((r) => r.job_id === id),
  }
}

export const userById = (id: number): User | null => store.users.find((u) => u.id === id) ?? null

export const applicantRows = (jobId: number): ApplicantView[] =>
  store.applications
    .filter((a) => a.job_id === jobId)
    .map((a) => {
      const candidate = userById(a.candidate_id)!
      const resume = store.resumes.find((r) => r.id === a.resume_id)
      const assessment = ASSESSMENTS.find((x) => x.application_id === a.id) ?? null
      const score = assessment
        ? {
            overall: assessment.overall,
            skills: assessment.skills,
            experience: assessment.experience,
            projects: assessment.projects,
            qualifications: assessment.qualifications,
            confidence: assessment.confidence,
            insufficient_evidence: assessment.insufficient_evidence,
            ai_mode: assessment.ai_mode,
            embedding_mode: assessment.embedding_mode,
            model: assessment.model,
          }
        : null
      return {
        application_id: a.id,
        job_id: a.job_id,
        stage: a.stage,
        candidate: { id: candidate.id, name: candidate.full_name, email: candidate.email },
        resume_id: a.resume_id,
        resume_filename: resume?.filename ?? '',
        score,
        matched: assessment?.skills_detail.filter((s) => s.status === 'matched').map((s) => s.label) ?? [],
        missing: assessment?.skills_detail.filter((s) => s.status === 'not_evidenced' || s.status === 'confirmed_absent').map((s) => s.label) ?? [],
        has_notes: store.notes.some((n) => n.application_id === a.id),
        override_score: a.override_score,
        override_reason: a.override_reason,
        applied_at: a.created_at,
      }
    })
    .sort((a, b) => (b.score?.overall ?? 0) - (a.score?.overall ?? 0))

export const applicationDetail = (appId: number): ApplicationDetail | null => {
  const a = store.applications.find((x) => x.id === appId)
  if (!a) return null
  const job = jobSummaries().find((j) => j.id === a.job_id)!
  const candidate = userById(a.candidate_id)!
  const resume = store.resumes.find((r) => r.id === a.resume_id) ?? null
  const assessment = ASSESSMENTS.find((x) => x.application_id === a.id) ?? null
  return {
    ...a,
    job,
    candidate,
    resume,
    assessment,
    events: store.events.filter((e) => e.application_id === a.id).sort((x, y) => y.created_at.localeCompare(x.created_at)),
    notes: store.notes.filter((n) => n.application_id === a.id).sort((x, y) => y.created_at.localeCompare(x.created_at)),
    questions: store.questions.filter((q) => q.application_id === a.id),
    interviews: store.interviews.filter((i) => i.application_id === a.id),
  }
}

export const analytics = (): AnalyticsOverview => {
  const apps = store.applications
  const shortlisted = apps.filter((a) => a.stage === 'shortlisted' || a.stage === 'interview' || a.stage === 'selected')
  const open = store.jobs.filter((j) => j.status === 'open')

  const byJob = store.jobs
    .filter((j) => apps.some((a) => a.job_id === j.id))
    .map((j) => {
      const js = apps.filter((a) => a.job_id === j.id)
      return {
        job_id: j.id,
        title: j.title,
        applications: js.length,
        shortlisted: js.filter((a) => shortlisted.some((s) => s.id === a.id)).length,
        interviews: store.interviews.filter((i) => js.some((a) => a.id === i.application_id)).length,
      }
    })

  const stageOrder = ['submitted', 'parsed', 'assessed', 'recruiter_review', 'shortlisted', 'interview', 'selected', 'rejected'] as const
  const byStage = stageOrder
    .map((stage) => ({ stage, count: apps.filter((a) => a.stage === stage).length }))
    .filter((x) => x.count > 0)

  return {
    active_jobs: open.length,
    applications: apps.length,
    shortlisted: shortlisted.length,
    pending_reviews: apps.filter((a) => ['submitted', 'parsed', 'assessed', 'recruiter_review'].includes(a.stage)).length,
    interviews: store.interviews.filter((i) => i.status === 'scheduled').length,
    shortlist_rate: apps.length ? Math.round((shortlisted.length / apps.length) * 1000) / 10 : 0,
    avg_processing_hours: 26.4,
    by_job: byJob,
    by_stage: byStage,
    common_gaps: [
      { skill: 'PostgreSQL', count: 2 },
      { skill: 'Django', count: 2 },
      { skill: 'AWS', count: 2 },
      { skill: 'Docker', count: 1 },
    ],
  }
}

export const findUser = (email: string) => store.users.find((u) => u.email.toLowerCase() === email.toLowerCase())

export const nextId = () => ++store.nextId
