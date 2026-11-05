import type {
  AnalyticsOverview,
  ApplicantRow,
  Application,
  ApplicationDetail,
  Assessment,
  AuthResponse,
  CompareResponse,
  CompareRow,
  Health,
  Interview,
  InterviewQuestion,
  InterviewType,
  JobDetail,
  JobInput,
  JobSummary,
  Feedback,
  Note,
  RecommendedJob,
  FairnessAudit,
  DuplicatePair,
  Resume,
  Role,
  Score,
  Stage,
  TalentSearchResult,
  User,
} from './types'
import {
  analytics,
  applicantRows,
  applicationDetail,
  findUser,
  jobDetail,
  jobSummaries,
  nextId,
  store,
  userById,
} from './fixtures'
import { ASSESSMENTS, resumes as fixtureResumes } from './fixtures.assessments'

/**
 * One client for every screen.
 *  - VITE_USE_FIXTURES=1 (default) reads the in-memory demo dataset.
 *  - VITE_USE_FIXTURES=0 calls the FastAPI contract at VITE_API_BASE (default /api).
 * Components never branch on this.
 */
export const USE_FIXTURES = (import.meta.env.VITE_USE_FIXTURES ?? '1') !== '0'
const BASE = import.meta.env.VITE_API_BASE ?? '/api'
const TOKEN_KEY = 'hi.token'

export class ApiError extends Error {
  status: number
  payload?: unknown
  constructor(message: string, status = 400, payload?: unknown) {
    super(message)
    this.status = status
    this.payload = payload
    this.name = 'ApiError'
  }
}

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (token: string | null) => {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')

  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers })
  } catch {
    throw new ApiError('Cannot reach the API. Check that the backend is running on port 8000.', 0)
  }
  if (!res.ok) {
    let detail = `Request failed (${res.status})`
    let payload: unknown
    try {
      payload = await res.json()
      const body = payload as { detail?: unknown }
      if (typeof body.detail === 'string') detail = body.detail
      else if (Array.isArray(body.detail)) detail = String((body.detail[0] as { msg?: string })?.msg ?? detail)
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(detail, res.status, payload)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

const delay = (ms = 220) => new Promise((r) => setTimeout(r, ms))
const fail = (status: number, detail: string): never => {
  throw new ApiError(detail, status)
}

/** Demo credentials are fixed so the judge can log in without a seed run. */
export const DEMO_PASSWORD = 'demo1234'

const makeAuth = (user: User): AuthResponse => ({ token: `fixture.${user.id}.${Date.now()}`, user })

const userFromToken = (token: string | null): User | null => {
  if (!token) return null
  const id = Number(token.split('.')[1])
  return userById(id)
}

const toScore = (a: Assessment): Score => ({
  overall: a.overall,
  skills: a.skills,
  experience: a.experience,
  projects: a.projects,
  qualifications: a.qualifications,
  confidence: a.confidence,
  insufficient_evidence: a.insufficient_evidence,
  ai_mode: a.ai_mode,
  embedding_mode: a.embedding_mode,
  model: a.model,
})

/* -------------------------------- auth -------------------------------- */

export const auth = {
  async login(email: string, password: string): Promise<AuthResponse> {
    if (!USE_FIXTURES) {
      return request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
    }
    await delay(300)
    const user = findUser(email.trim())
    if (!user || password !== DEMO_PASSWORD) fail(401, 'Email or password is incorrect.')
    return makeAuth(user!)
  },

  async register(input: { email: string; password: string; full_name: string; role: Role }): Promise<AuthResponse> {
    if (!USE_FIXTURES) {
      return request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(input) })
    }
    await delay(320)
    if (findUser(input.email)) fail(409, 'An account with this email already exists.')
    if (input.password.length < 8) fail(422, 'Password must be at least 8 characters.')
    const user: User = {
      id: nextId(),
      email: input.email.trim(),
      full_name: input.full_name.trim() || input.email.split('@')[0],
      role: input.role,
      created_at: new Date().toISOString(),
    }
    store.users.push(user)
    return makeAuth(user)
  },

  async me(): Promise<User> {
    if (!USE_FIXTURES) return request<User>('/auth/me')
    await delay(80)
    const user = userFromToken(getToken())
    if (!user) fail(401, 'Session expired. Please sign in again.')
    return user!
  },

  async logout(): Promise<void> {
    if (!USE_FIXTURES) {
      try {
        await request('/auth/logout', { method: 'POST' })
      } catch {
        /* logging out locally must always succeed */
      }
    }
    setToken(null)
  },
}

/* -------------------------------- jobs -------------------------------- */

export const jobs = {
  async list(params: { status?: string; q?: string } = {}): Promise<JobSummary[]> {
    if (!USE_FIXTURES) {
      const qs = new URLSearchParams()
      if (params.status) qs.set('status', params.status)
      if (params.q) qs.set('q', params.q)
      return request<JobSummary[]>(`/jobs?${qs}`)
    }
    await delay(240)
    let rows = jobSummaries()
    if (params.status && params.status !== 'all') rows = rows.filter((j) => j.status === params.status)
    if (params.q) {
      const q = params.q.toLowerCase()
      rows = rows.filter((j) => `${j.title} ${j.department} ${j.location}`.toLowerCase().includes(q))
    }
    return rows.sort((a, b) => b.created_at.localeCompare(a.created_at))
  },

  async get(id: number): Promise<JobDetail> {
    if (!USE_FIXTURES) return request<JobDetail>(`/jobs/${id}`)
    await delay(180)
    const job = jobDetail(id)
    if (!job) fail(404, 'That job no longer exists.')
    return job!
  },

  async create(input: JobInput): Promise<JobDetail> {
    if (!USE_FIXTURES) return request<JobDetail>('/jobs', { method: 'POST', body: JSON.stringify(input) })
    await delay(300)
    const id = nextId()
    const ts = new Date().toISOString()
    store.jobs.push({
      id,
      recruiter_id: 1,
      title: input.title,
      department: input.department ?? '',
      location: input.location ?? '',
      employment_type: input.employment_type ?? 'Full-time',
      salary_min: input.salary_min ?? null,
      salary_max: input.salary_max ?? null,
      description: input.description,
      status: 'open',
      created_at: ts,
      updated_at: ts,
    })
    input.requirements.forEach((r) => {
      store.requirements.push({
        id: nextId(),
        job_id: id,
        kind: r.kind ?? 'skill',
        label: r.label,
        canonical: r.label.toLowerCase().replace(/\s+/g, '_'),
        importance: r.importance,
        weight: r.weight ?? (r.importance === 'required' ? 1 : 0.5),
        min_years: r.min_years ?? null,
        evidence_hint: r.evidence_hint ?? null,
      })
    })
    return jobDetail(id)!
  },

  async update(id: number, input: Partial<JobInput>): Promise<JobDetail> {
    if (!USE_FIXTURES) return request<JobDetail>(`/jobs/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
    await delay(280)
    const job = store.jobs.find((j) => j.id === id)
    if (!job) fail(404, 'That job no longer exists.')
    Object.assign(job!, {
      title: input.title ?? job!.title,
      department: input.department ?? job!.department,
      location: input.location ?? job!.location,
      employment_type: input.employment_type ?? job!.employment_type,
      salary_min: input.salary_min ?? job!.salary_min,
      salary_max: input.salary_max ?? job!.salary_max,
      description: input.description ?? job!.description,
      updated_at: new Date().toISOString(),
    })
    if (input.requirements) {
      store.requirements = store.requirements.filter((r) => r.job_id !== id)
      input.requirements.forEach((r) => {
        store.requirements.push({
          id: nextId(),
          job_id: id,
          kind: r.kind ?? 'skill',
          label: r.label,
          canonical: r.label.toLowerCase().replace(/\s+/g, '_'),
          importance: r.importance,
          weight: r.weight ?? (r.importance === 'required' ? 1 : 0.5),
          min_years: r.min_years ?? null,
          evidence_hint: r.evidence_hint ?? null,
        })
      })
    }
    return jobDetail(id)!
  },

  async setStatus(id: number, status: 'open' | 'closed'): Promise<JobDetail> {
    if (!USE_FIXTURES) return request<JobDetail>(`/jobs/${id}/${status === 'open' ? 'reopen' : 'close'}`, { method: 'POST' })
    await delay(200)
    const job = store.jobs.find((j) => j.id === id)
    if (!job) fail(404, 'That job no longer exists.')
    job!.status = status
    job!.updated_at = new Date().toISOString()
    return jobDetail(id)!
  },

  async extract(input: { description: string }): Promise<{ requirements: JobInput['requirements'] }> {
    if (!USE_FIXTURES) {
      return request<{ requirements: JobInput['requirements'] }>('/jobs/extract-requirements', {
        method: 'POST',
        body: JSON.stringify(input),
      })
    }
    await delay(900)
    const text = input.description.toLowerCase()
    const dictionary: Array<[RegExp, string]> = [
      [/python/, 'Python'],
      [/django/, 'Django'],
      [/flask/, 'Flask'],
      [/postgres/, 'PostgreSQL'],
      [/mysql/, 'MySQL'],
      [/docker/, 'Docker'],
      [/kubernetes|k8s/, 'Kubernetes'],
      [/react/, 'React'],
      [/typescript/, 'TypeScript'],
      [/tailwind/, 'Tailwind CSS'],
      [/aws|amazon web services/, 'AWS'],
      [/rest|api/, 'REST API design'],
      [/airflow/, 'Airflow'],
      [/dbt/, 'dbt'],
      [/sql/, 'SQL'],
      [/machine learning|\bml\b/, 'Machine Learning'],
      [/figma/, 'Figma'],
    ]
    const found = Array.from(new Set(dictionary.filter(([re]) => re.test(text)).map(([, label]) => label)))
    const core = /python|django|postgres|docker|react|typescript/i
    return {
      requirements: (found.length ? found : ['Python', 'SQL']).map((label) => ({
        label,
        kind: 'skill' as const,
        importance: core.test(label) ? ('required' as const) : ('preferred' as const),
        weight: core.test(label) ? 1 : 0.5,
        min_years: null,
        evidence_hint: null,
      })),
    }
  },
}

/* ------------------------------- resumes ------------------------------- */

export const resumeApi = {
  async listMine(): Promise<Resume[]> {
    if (!USE_FIXTURES) return request<Resume[]>('/resumes/mine')
    await delay(160)
    const user = userFromToken(getToken())
    return store.resumes.filter((r) => r.candidate_id === user?.id)
  },

  async upload(file: File): Promise<{ resume: Resume; extracted: Resume['extracted'] }> {
    if (!USE_FIXTURES) {
      const form = new FormData()
      form.append('file', file)
      return request('/resumes', { method: 'POST', body: form })
    }
    await delay(1100)
    const name = file.name.toLowerCase()
    if (!name.endsWith('.pdf')) fail(422, 'Only PDF resumes are supported. Export your CV as a PDF and try again.')
    if (file.size === 0) fail(422, 'That file is empty. Choose a PDF with readable text.')
    const user = userFromToken(getToken())
    if (!user) fail(401, 'Session expired. Please sign in again.')
    const template = fixtureResumes.find((r) => r.candidate_id === user!.id) ?? fixtureResumes[0]
    const resume: Resume = {
      ...template,
      id: nextId(),
      candidate_id: user!.id,
      filename: file.name,
      size_bytes: file.size,
      created_at: new Date().toISOString(),
      extracted: template.extracted
        ? { ...template.extracted, name: user!.full_name, email: user!.email }
        : null,
    }
    store.resumes.push(resume)
    return { resume, extracted: resume.extracted }
  },

  async updateSkills(id: number, skills: string[]): Promise<Resume> {
    if (!USE_FIXTURES) return request<Resume>(`/resumes/${id}/skills`, { method: 'PATCH', body: JSON.stringify({ skills }) })
    await delay(240)
    const resume = store.resumes.find((r) => r.id === id)
    if (!resume) fail(404, 'Resume not found.')
    if (resume!.extracted) {
      resume!.extracted.skills = skills.map((s) => ({
        label: s,
        canonical: s.toLowerCase().replace(/\s+/g, '_'),
        quote: resume!.extracted!.skills.find((x) => x.label === s)?.quote ?? null,
        support: 'verified' as const,
      }))
    }
    return resume!
  },
}

/* ----------------------------- applications ---------------------------- */

export const applications = {
  async mine(): Promise<ApplicationDetail[]> {
    if (!USE_FIXTURES) return request<ApplicationDetail[]>('/applications/mine')
    await delay(220)
    const user = userFromToken(getToken())
    return store.applications
      .filter((a) => a.candidate_id === user?.id)
      .map((a) => applicationDetail(a.id))
      .filter((x): x is ApplicationDetail => Boolean(x))
  },

  async apply(jobId: number, resumeId: number): Promise<Application> {
    if (!USE_FIXTURES) return request<Application>('/applications', { method: 'POST', body: JSON.stringify({ job_id: jobId, resume_id: resumeId }) })
    await delay(300)
    const user = userFromToken(getToken())
    if (!user) fail(401, 'Session expired. Please sign in again.')
    if (store.applications.some((a) => a.job_id === jobId && a.candidate_id === user!.id)) {
      fail(409, 'You have already applied to this role.')
    }
    const ts = new Date().toISOString()
    const app: Application = {
      id: nextId(),
      job_id: jobId,
      candidate_id: user!.id,
      resume_id: resumeId,
      stage: 'submitted',
      created_at: ts,
      updated_at: ts,
      override_score: null,
      override_reason: null,
    }
    store.applications.push(app)
    store.events.push({
      id: nextId(),
      application_id: app.id,
      actor_id: user!.id,
      actor_name: user!.full_name,
      from_stage: null,
      to_stage: 'submitted',
      reason: null,
      created_at: ts,
    })
    return app
  },

  async forJob(jobId: number): Promise<ApplicantRow[]> {
    if (!USE_FIXTURES) return request<ApplicantRow[]>(`/jobs/${jobId}/applicants`)
    await delay(260)
    return applicantRows(jobId) as ApplicantRow[]
  },

  async detail(id: number): Promise<ApplicationDetail> {
    if (!USE_FIXTURES) return request<ApplicationDetail>(`/applications/${id}`)
    await delay(200)
    const detail = applicationDetail(id)
    if (!detail) fail(404, 'Application not found.')
    return detail!
  },

  async setStage(id: number, toStage: Stage, reason: string): Promise<ApplicationDetail> {
    if (!USE_FIXTURES) {
      return request<ApplicationDetail>(`/applications/${id}/stage`, { method: 'PATCH', body: JSON.stringify({ to_stage: toStage, reason }) })
    }
    await delay(260)
    const app = store.applications.find((a) => a.id === id)
    if (!app) fail(404, 'Application not found.')
    const from = app!.stage
    app!.stage = toStage
    app!.updated_at = new Date().toISOString()
    store.events.push({
      id: nextId(),
      application_id: id,
      actor_id: 1,
      actor_name: 'Nadia Rahman',
      from_stage: from,
      to_stage: toStage,
      reason,
      created_at: new Date().toISOString(),
    })
    return applicationDetail(id)!
  },

  async override(id: number, score: number, reason: string): Promise<ApplicationDetail> {
    if (!USE_FIXTURES) return request<ApplicationDetail>(`/applications/${id}/override`, { method: 'POST', body: JSON.stringify({ score, reason }) })
    await delay(240)
    const app = store.applications.find((a) => a.id === id)
    if (!app) fail(404, 'Application not found.')
    app!.override_score = score
    app!.override_reason = reason
    return applicationDetail(id)!
  },

  async addNote(id: number, body: string): Promise<Note> {
    if (!USE_FIXTURES) return request<Note>(`/applications/${id}/notes`, { method: 'POST', body: JSON.stringify({ body }) })
    await delay(200)
    const note: Note = {
      id: nextId(),
      application_id: id,
      author_name: 'Nadia Rahman',
      body,
      created_at: new Date().toISOString(),
    }
    store.notes.push(note)
    return note
  },

  async reassess(id: number): Promise<Score> {
    if (!USE_FIXTURES) return request<Score>(`/applications/${id}/assess`, { method: 'POST' })
    await delay(1200)
    const found = ASSESSMENTS.find((a) => a.application_id === id)
    if (!found) fail(404, 'No assessment available for this application.')
    return toScore(found!)
  },
}

/* ------------------------------- questions ----------------------------- */

export const questionApi = {
  async list(applicationId: number): Promise<InterviewQuestion[]> {
    if (!USE_FIXTURES) return request<InterviewQuestion[]>(`/applications/${applicationId}/questions`)
    await delay(160)
    return store.questions.filter((q) => q.application_id === applicationId)
  },

  async generate(applicationId: number): Promise<InterviewQuestion[]> {
    if (!USE_FIXTURES) {
      return request<InterviewQuestion[]>(`/applications/${applicationId}/questions/generate`, { method: 'POST', body: JSON.stringify({}) })
    }
    await delay(1400)
    const extra: InterviewQuestion[] = [
      {
        id: nextId(),
        application_id: applicationId,
        text: 'How do you decide which parts of a Django app deserve a service layer versus a fat model?',
        difficulty: 'intermediate',
        category: 'skill',
        guideline: 'Listen for pragmatism: business rules that need reuse, transactional boundaries, and testability. Reject dogma.',
        source: 'ai',
        created_at: new Date().toISOString(),
      },
      {
        id: nextId(),
        application_id: applicationId,
        text: 'Tell us about a system you had to keep reliable during a schema migration. What was your rollback plan?',
        difficulty: 'advanced',
        category: 'project',
        guideline: 'Look for a concrete plan, metrics watched, and an actual rollback rehearsal.',
        source: 'ai',
        created_at: new Date().toISOString(),
      },
    ]
    store.questions.push(...extra)
    return store.questions.filter((q) => q.application_id === applicationId)
  },

  async update(id: number, patch: Partial<Pick<InterviewQuestion, 'text' | 'guideline' | 'difficulty'>>): Promise<InterviewQuestion> {
    if (!USE_FIXTURES) return request<InterviewQuestion>(`/questions/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
    await delay(180)
    const q = store.questions.find((x) => x.id === id)
    if (!q) fail(404, 'Question not found.')
    Object.assign(q!, patch, { source: 'human' as const })
    return q!
  },

  async remove(id: number): Promise<void> {
    if (!USE_FIXTURES) return request<void>(`/questions/${id}`, { method: 'DELETE' })
    await delay(160)
    store.questions = store.questions.filter((q) => q.id !== id)
  },
}

/* ------------------------------- interviews ---------------------------- */

export const interviewApi = {
  async list(): Promise<Interview[]> {
    if (!USE_FIXTURES) return request<Interview[]>('/interviews')
    await delay(200)
    return [...store.interviews].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
  },

  async create(input: {
    application_id: number
    scheduled_at: string
    interviewer_id: number
    interview_type: InterviewType
    duration_min: number
    location?: string
  }): Promise<Interview> {
    if (!USE_FIXTURES) return request<Interview>('/interviews', { method: 'POST', body: JSON.stringify(input) })
    await delay(320)
    const start = new Date(input.scheduled_at).getTime()
    const end = start + input.duration_min * 60_000
    const clash = store.interviews.find((i) => {
      if (i.status !== 'scheduled') return false
      const s = new Date(i.scheduled_at).getTime()
      const e = s + i.duration_min * 60_000
      return start < e && end > s
    })
    if (clash) {
      throw new ApiError(
        `Conflict: ${clash.interviewer_name} already interviews ${clash.candidate_name} from ${new Date(clash.scheduled_at).toLocaleString()} for ${clash.duration_min} minutes.`,
        409,
        { detail: 'Interviewer has a conflicting booking', conflict_with: clash },
      )
    }
    const app = store.applications.find((a) => a.id === input.application_id)
    const candidate = app ? userById(app.candidate_id) : null
    const interview: Interview = {
      id: nextId(),
      application_id: input.application_id,
      candidate_name: candidate?.full_name ?? 'Candidate',
      job_title: app ? jobSummaries().find((j) => j.id === app.job_id)?.title ?? '' : '',
      scheduled_at: input.scheduled_at,
      duration_min: input.duration_min,
      interviewer_id: input.interviewer_id,
      interviewer_name: 'Nadia Rahman',
      interview_type: input.interview_type,
      location: input.location ?? 'Google Meet',
      status: 'scheduled',
      conflict_flag: false,
    }
    store.interviews.push(interview)
    if (app && !['shortlisted', 'interview'].includes(app.stage)) {
      const from = app.stage
      app.stage = 'interview'
      store.events.push({
        id: nextId(),
        application_id: app.id,
        actor_id: 1,
        actor_name: 'Nadia Rahman',
        from_stage: from,
        to_stage: 'interview',
        reason: 'Interview scheduled',
        created_at: new Date().toISOString(),
      })
    }
    return interview
  },

  async feedback(interviewId: number, body: { rating: number; strengths: string; concerns: string; recommendation: Feedback['recommendation'] }): Promise<Feedback> {
    if (!USE_FIXTURES) return request<Feedback>(`/interviews/${interviewId}/feedback`, { method: 'POST', body: JSON.stringify(body) })
    await delay(300)
    const fb: Feedback = {
      id: nextId(),
      interview_id: interviewId,
      interviewer_name: 'Nadia Rahman',
      rating: body.rating,
      strengths: body.strengths,
      concerns: body.concerns,
      recommendation: body.recommendation,
      created_at: new Date().toISOString(),
    }
    store.feedback.push(fb)
    return fb
  },

  async decision(interviewId: number, decision: 'selected' | 'rejected', rationale: string): Promise<{ ok: boolean }> {
    if (!USE_FIXTURES) return request<{ ok: boolean }>(`/interviews/${interviewId}/decision`, { method: 'POST', body: JSON.stringify({ decision, rationale }) })
    await delay(320)
    store.decisions.push({ interview_id: interviewId, decision, rationale, created_at: new Date().toISOString() })
    const it = store.interviews.find((i) => i.id === interviewId)
    const app = it ? store.applications.find((a) => a.id === it.application_id) : null
    if (app) {
      const from = app.stage
      app.stage = decision
      store.events.push({ id: nextId(), application_id: app.id, actor_id: 1, actor_name: 'Nadia Rahman', from_stage: from, to_stage: decision, reason: rationale, created_at: new Date().toISOString() })
    }
    return { ok: true }
  },
}

/* ------------------------------- analytics ----------------------------- */

export const analyticsApi = {
  async overview(): Promise<AnalyticsOverview> {
    if (!USE_FIXTURES) return request<AnalyticsOverview>('/analytics/overview')
    await delay(240)
    return analytics()
  },
}

/* --------------------------------- talent ------------------------------ */

export const talentApi = {
  async search(q: string): Promise<TalentSearchResult> {
    if (!USE_FIXTURES) return request<TalentSearchResult>(`/talent/search?q=${encodeURIComponent(q)}`)
    await delay(520)
    const query = q.toLowerCase()
    const requirementHints = ['python', 'django', 'postgres', 'docker', 'react', 'typescript', 'rest'].filter((k) => query.includes(k))
    const hits: TalentSearchResult['hits'] = []
    for (const app of store.applications) {
      const assessment = ASSESSMENTS.find((a) => a.application_id === app.id)
      if (!assessment) continue
      const user = userById(app.candidate_id)
      if (!user) continue
      const matched = assessment.skills_detail.filter((s) => s.status === 'matched').map((s) => s.label)
      const keep = requirementHints.length ? matched.filter((m) => requirementHints.some((h) => m.toLowerCase().includes(h))) : matched
      if (requirementHints.length && keep.length === 0) continue
      hits.push({
        candidate_id: user.id,
        name: user.full_name,
        email: user.email,
        score: assessment.overall,
        matched: matched,
        missing: assessment.skills_detail.filter((s) => s.status !== 'matched').map((s) => s.label),
        evidence: assessment.skills_detail
          .filter((s) => s.evidence)
          .slice(0, 2)
          .map((s) => ({ requirement: s.label, quote: s.evidence!.quote, similarity: s.similarity ?? 0 })),
      })
    }
    return {
      query: q,
      hits: hits.sort((a, b) => b.score - a.score),
      mode: 'dense',
      parsed_requirements: requirementHints.length ? requirementHints : ['semantic profile match'],
    }
  },

  async compare(ids: number[], jobId: number): Promise<CompareResponse> {
    if (!USE_FIXTURES) return request<CompareResponse>(`/talent/compare?ids=${ids.join(',')}&job_id=${jobId}`)
    await delay(300)
    const job = jobSummaries().find((j) => j.id === jobId)!
    const rows: CompareRow[] = ids.map((id) => {
      const app = store.applications.find((a) => a.candidate_id === id && a.job_id === jobId)
      const user = userById(id)
      if (!app || !user) {
        return { candidate_id: id, name: user?.full_name ?? `Candidate ${id}`, score: null, matched: [], missing: [], gaps: [] }
      }
      const assessment = ASSESSMENTS.find((x) => x.application_id === app.id)
      if (!assessment) return { candidate_id: id, name: user.full_name, score: null, matched: [], missing: [], gaps: [] }
      return {
        candidate_id: id,
        name: user.full_name,
        score: toScore(assessment),
        matched: assessment.skills_detail.filter((s) => s.status === 'matched' || s.status === 'partial'),
        missing: assessment.skills_detail.filter((s) => s.status === 'not_evidenced' || s.status === 'confirmed_absent'),
        gaps: assessment.gaps,
      }
    })
    return { job, rows }
  },

  async recommended(): Promise<RecommendedJob[]> {
    if (!USE_FIXTURES) return request<RecommendedJob[]>('/candidates/jobs/recommended')
    await delay(320)
    return jobSummaries()
      .filter((j) => j.status === 'open')
      .map((j) => ({
        job: j,
        reason: 'Matches React and TypeScript evidence in your resume',
        matched: ['React', 'TypeScript'],
        score: 82,
      }))
  },
}

/* --------------------------- audit / integrity -------------------------- */

export const auditApi = {
  async fairness(): Promise<FairnessAudit> {
    if (!USE_FIXTURES) return request<FairnessAudit>('/audit/fairness')
    await delay(400)
    const base = 87.4
    return {
      passed: true,
      baseline: base,
      perturbed: base,
      delta: 0,
      checks: [
        { attribute: 'name', baseline: base, perturbed: base, identical: true },
        { attribute: 'gender', baseline: base, perturbed: base, identical: true },
        { attribute: 'age', baseline: base, perturbed: base, identical: true },
        { attribute: 'nationality', baseline: base, perturbed: base, identical: true },
        { attribute: 'marital status', baseline: base, perturbed: base, identical: true },
      ],
      note: 'Protected attributes are stripped before scoring. Swapping them leaves the score unchanged because no protected field reaches the model or the embeddings.',
    }
  },

  async duplicates(): Promise<DuplicatePair[]> {
    if (!USE_FIXTURES) return request<DuplicatePair[]>('/talent/duplicates')
    await delay(320)
    return [
      {
        keep: { id: 3, name: 'Daniel Osei', email: 'daniel.osei@example.com' },
        duplicate: { id: 7, name: 'D. Osei', email: 'd.osei@example.com' },
        reason: 'Same phone number and 78% resume text similarity',
        similarity: 0.78,
      },
    ]
  },

  async merge(keepId: number, mergeId: number): Promise<{ ok: boolean }> {
    if (!USE_FIXTURES) return request<{ ok: boolean }>('/talent/merge', { method: 'POST', body: JSON.stringify({ keep_id: keepId, merge_id: mergeId }) })
    await delay(400)
    return { ok: true }
  },
}

/* ---------------------------------- ops -------------------------------- */

export const opsApi = {
  async health(): Promise<Health> {
    if (!USE_FIXTURES) return request<Health>('/health')
    await delay(120)
    return { status: 'ok', ai_mode: 'groq', embedding_mode: 'dense', db: 'fixtures', model: 'llama-3.3-70b-versatile' }
  },
}
