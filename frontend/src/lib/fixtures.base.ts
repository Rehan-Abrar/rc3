import type { Evidence, ExtractedProfile, JobDetail, Requirement, Resume, User } from './types'

export type RequirementRow = Requirement & { job_id: number }

/** A job row before counts/requirements are attached. */
export type JobRecord = Omit<JobDetail, 'requirements' | 'applicant_count' | 'shortlisted_count' | 'interview_count'>

/* ------------------------------------------------------------------ *
 * Demo dataset. Every evidence quote below is a literal substring of
 * the matching resume text, so the UI can prove the AI is not inventing
 * anything. Offsets are computed, never hardcoded.
 * ------------------------------------------------------------------ */

export const RESUME_AYESHA = `AYESHA KHAN
Backend Engineer - Karachi, Pakistan - ayesha.khan@example.com - +92 300 1234567
github.com/ayeshakhan

SUMMARY
Backend engineer with 5 years building production APIs and data-heavy services.

SKILLS
Python, Django, PostgreSQL, Docker, Redis, Celery, AWS (ECS, RDS), REST API design, pytest

EXPERIENCE
Senior Backend Engineer - Northwind Logistics (Mar 2021 - Present)
Designed and shipped 30+ Django REST endpoints serving 2M requests per day.
Led the migration from MySQL to PostgreSQL with zero downtime.
Containerised the whole stack with Docker and docker-compose for local and CI parity.

Backend Engineer - Pixelette (Jul 2019 - Feb 2021)
Built Python services for payment reconciliation and reporting.
Wrote the REST API layer consumed by the partner dashboard.

EDUCATION
BS Computer Science - NED University of Engineering and Technology (2015 - 2019)

PROJECTS
Ledger Service - Django + PostgreSQL ledger with idempotent payment writes and Redis-backed locks.
GeoRank - internal tool ranking delivery routes with a Python scoring pipeline.

CERTIFICATIONS
AWS Certified Developer - Associate`

export const RESUME_DANIEL = `DANIEL OSEI
Software Developer - Accra, Ghana - daniel.osei@example.com - +233 24 555 0182

SUMMARY
Developer with 3 years of experience in Python web services and relational databases.

SKILLS
Python, Flask, MySQL, Docker, Git, REST API

EXPERIENCE
Software Developer - Kestrel Health (Jan 2022 - Present)
Maintained Flask services for patient scheduling and billing.
Packaged services with Docker for staging deployments.

Junior Developer - Kestrel Health (Jun 2021 - Dec 2021)
Wrote SQL reports against MySQL for the operations team.

EDUCATION
BSc Information Technology - University of Ghana (2017 - 2021)

PROJECTS
Clinic Queue - Flask + MySQL queue management tool with SMS notifications.`

export const RESUME_MARCO = `MARCO SILVA
Full-stack Developer - Lisbon, Portugal - marco.silva@example.com - +351 91 555 0199

SUMMARY
Full-stack developer focused on JavaScript products, moving toward backend Python.

SKILLS
JavaScript, TypeScript, Node.js, React, MongoDB, Express, Python (basic), Docker

EXPERIENCE
Frontend Developer - Tidepool Studio (Feb 2022 - Present)
Built React dashboards and Node.js BFF endpoints for fintech clients.
Set up Docker-based preview environments for every pull request.

Web Developer - Freelance (2020 - 2022)
Delivered marketing sites and small Express APIs backed by MongoDB.

EDUCATION
BSc Software Engineering - Universidade de Lisboa (2016 - 2020)

PROJECTS
PayTrack - React + Express expense tracker with MongoDB storage and JWT auth.`

export const RESUME_TOMAS = `TOMAS BERG
Junior Developer - Malmo, Sweden - tomas.berg@example.com

SUMMARY
Recent graduate looking for a first backend role.

SKILLS
HTML, CSS, basic JavaScript

I have no formal backend training yet.
No commercial experience with Docker yet.
No commercial experience with PostgreSQL yet.

EDUCATION
BSc Computer Science - Malmo University (2019 - 2023)`

export const RESUME_AYESHA_FE = `AYESHA KHAN
Frontend-leaning product engineer - ayesha.khan@example.com

SUMMARY
Five years across React and TypeScript product teams, comfortable owning design systems.

SKILLS
React, TypeScript, Tailwind CSS, accessibility, Vitest, Storybook

EXPERIENCE
Product Engineer - Northwind (2021 - Present)
Built the internal design system in React and TypeScript.
Migrated legacy CSS to Tailwind CSS and documented the component API.

EDUCATION
BS Computer Science - NED University (2015 - 2019)`

export const ev = (raw: string, quote: string): Evidence => {
  const start = raw.indexOf(quote)
  if (start < 0) throw new Error(`fixture quote not found in resume: ${quote.slice(0, 40)}`)
  return { quote, start, end: start + quote.length }
}

export const iso = (daysAgo: number, hour = 9, minute = 0) => {
  const d = new Date('2026-11-05T09:00:00Z')
  d.setUTCDate(d.getUTCDate() - daysAgo)
  d.setUTCHours(hour, minute, 0, 0)
  return d.toISOString()
}

export const users: User[] = [
  { id: 1, email: 'recruiter@hire.dev', full_name: 'Nadia Rahman', role: 'recruiter', created_at: iso(30) },
  { id: 2, email: 'candidate@hire.dev', full_name: 'Ayesha Khan', role: 'candidate', created_at: iso(20) },
  { id: 3, email: 'daniel.osei@example.com', full_name: 'Daniel Osei', role: 'candidate', created_at: iso(19) },
  { id: 4, email: 'marco.silva@example.com', full_name: 'Marco Silva', role: 'candidate', created_at: iso(18) },
  { id: 5, email: 'tomas.berg@example.com', full_name: 'Tomas Berg', role: 'candidate', created_at: iso(17) },
  // Deliberate duplicate record: same person re-applied through a second account.
  { id: 7, email: 'd.osei@example.com', full_name: 'Daniel O.', role: 'candidate', created_at: iso(16) },
]

export const jobRequirements: RequirementRow[] = [
  { id: 1, job_id: 1, kind: 'skill', label: 'Python', canonical: 'python', importance: 'required', weight: 1, min_years: 3, evidence_hint: 'Backend services, scripting or data work in Python.' },
  { id: 2, job_id: 1, kind: 'skill', label: 'Django', canonical: 'django', importance: 'required', weight: 1, min_years: 2, evidence_hint: 'Django or Django REST Framework in production.' },
  { id: 3, job_id: 1, kind: 'skill', label: 'PostgreSQL', canonical: 'postgresql', importance: 'required', weight: 1, min_years: 2, evidence_hint: 'Schema design, query tuning or migrations on PostgreSQL.' },
  { id: 4, job_id: 1, kind: 'skill', label: 'Docker', canonical: 'docker', importance: 'required', weight: 1, min_years: 1, evidence_hint: 'Containerised services, images or compose setups.' },
  { id: 5, job_id: 1, kind: 'skill', label: 'REST API design', canonical: 'rest_api', importance: 'preferred', weight: 0.6, min_years: null, evidence_hint: 'Designing or documenting HTTP APIs.' },
  { id: 6, job_id: 1, kind: 'skill', label: 'AWS', canonical: 'aws', importance: 'preferred', weight: 0.5, min_years: null, evidence_hint: 'Deploying or operating on AWS.' },
  { id: 7, job_id: 1, kind: 'qualification', label: "Bachelor's degree in Computer Science", canonical: 'bsc_cs', importance: 'required', weight: 1, min_years: null, evidence_hint: 'Degree in CS or a closely related field.' },
  { id: 8, job_id: 2, kind: 'skill', label: 'React', canonical: 'react', importance: 'required', weight: 1, min_years: 3, evidence_hint: 'Production React with modern hooks.' },
  { id: 9, job_id: 2, kind: 'skill', label: 'TypeScript', canonical: 'typescript', importance: 'required', weight: 1, min_years: 2, evidence_hint: 'Typed application code, not just definitions.' },
  { id: 10, job_id: 2, kind: 'skill', label: 'Tailwind CSS', canonical: 'tailwind', importance: 'preferred', weight: 0.5, min_years: null, evidence_hint: 'Utility-first styling at product scale.' },
]

export const jobs: JobRecord[] = [
  {
    id: 1,
    recruiter_id: 1,
    title: 'Backend Developer',
    department: 'Platform Engineering',
    location: 'Remote (EU)',
    employment_type: 'Full-time',
    salary_min: 78000,
    salary_max: 98000,
    description:
      'We are hiring a Backend Developer to own the services behind our hiring platform. You will design Django REST APIs, model data in PostgreSQL, and ship containerised services with Docker. You will work with product and data teams to keep the API fast, observable and well documented.',
    status: 'open',
    created_at: iso(12, 10),
    updated_at: iso(2, 16),
  },
  {
    id: 2,
    recruiter_id: 1,
    title: 'Senior Frontend Engineer',
    department: 'Product',
    location: 'Hybrid - Lisbon',
    employment_type: 'Full-time',
    salary_min: 72000,
    salary_max: 90000,
    description:
      'Own the recruiter console in React and TypeScript. You will build dense, keyboard-first data interfaces, maintain a Tailwind CSS design system, and care about accessibility as much as velocity.',
    status: 'open',
    created_at: iso(9, 11),
    updated_at: iso(4, 12),
  },
  {
    id: 3,
    recruiter_id: 1,
    title: 'Data Engineer',
    department: 'Data',
    location: 'Remote',
    employment_type: 'Contract',
    salary_min: 60000,
    salary_max: 75000,
    description:
      'Build batch and streaming pipelines in Python, model warehouse tables with dbt, and keep orchestration healthy in Airflow.',
    status: 'closed',
    created_at: iso(26, 9),
    updated_at: iso(7, 15),
  },
]

/* --------------------------- resume helpers ---------------------------- */

export function makeResume(
  id: number,
  candidateId: number,
  filename: string,
  rawText: string,
  daysAgo: number,
): Resume {
  const user = users.find((u) => u.id === candidateId)
  const ext: ExtractedProfile = {
    name: user?.full_name ?? null,
    email: user?.email ?? null,
    phone: (rawText.match(/\+\d[\d\s]{7,}\d/) ?? [])[0] ?? null,
    links: (rawText.match(/github\.com\/[\w-]+/g) ?? []) as string[],
    summary: null,
    skills: [],
    experience: [],
    education: [],
    projects: [],
    certifications: [],
  }
  return {
    id,
    candidate_id: candidateId,
    filename,
    mime: 'application/pdf',
    size_bytes: 180_000 + id * 11_500,
    raw_text: rawText,
    page_count: 1,
    parse_status: 'ok',
    parse_error: null,
    extracted: ext,
    created_at: iso(daysAgo, 9),
  }
}
