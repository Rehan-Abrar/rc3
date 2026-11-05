import type { Assessment, Evidence, Resume, SkillRow } from './types'
import {
  RESUME_AYESHA,
  RESUME_AYESHA_FE,
  RESUME_DANIEL,
  RESUME_MARCO,
  RESUME_TOMAS,
  ev,
  iso,
  makeResume,
} from './fixtures.base'

/* ------------------------------- resumes ------------------------------- */

export const resumes: Resume[] = [
  makeResume(1, 2, 'ayesha-khan-backend.pdf', RESUME_AYESHA, 6),
  makeResume(2, 3, 'daniel-osei.pdf', RESUME_DANIEL, 5),
  makeResume(3, 4, 'marco-silva.pdf', RESUME_MARCO, 4),
  makeResume(4, 5, 'tomas-berg.pdf', RESUME_TOMAS, 3),
  makeResume(5, 2, 'ayesha-khan-frontend.pdf', RESUME_AYESHA_FE, 2),
  makeResume(6, 7, 'daniel-o-cv.pdf', RESUME_DANIEL, 1),
]

/* ----------------------------- assessments ----------------------------- */

type Row = {
  req: number
  label: string
  importance: 'required' | 'preferred'
  status: SkillRow['status']
  weight: number
  score: number
  sim: number | null
  raw: string
  quote?: string | null
  reason?: string
  learning?: string
}

const row = (r: Row): SkillRow => ({
  requirement_id: r.req,
  label: r.label,
  importance: r.importance,
  status: r.status,
  weight: r.weight,
  score: r.score,
  similarity: r.sim,
  evidence: r.quote ? (ev(r.raw, r.quote) as Evidence) : null,
  support: 'verified',
  reason: r.reason ?? '',
})

const AYESHA_ROWS: SkillRow[] = [
  row({ req: 1, label: 'Python', importance: 'required', status: 'matched', weight: 1, score: 1, sim: 0.94, raw: RESUME_AYESHA, quote: 'Backend engineer with 5 years building production APIs and data-heavy services.', reason: 'Five years of Python backend work in production.' }),
  row({ req: 2, label: 'Django', importance: 'required', status: 'matched', weight: 1, score: 1, sim: 0.91, raw: RESUME_AYESHA, quote: 'Designed and shipped 30+ Django REST endpoints serving 2M requests per day.', reason: 'Direct Django REST Framework delivery at scale.' }),
  row({ req: 3, label: 'PostgreSQL', importance: 'required', status: 'matched', weight: 1, score: 1, sim: 0.89, raw: RESUME_AYESHA, quote: 'Led the migration from MySQL to PostgreSQL with zero downtime.', reason: 'Owned a production PostgreSQL migration.' }),
  row({ req: 4, label: 'Docker', importance: 'required', status: 'matched', weight: 1, score: 1, sim: 0.9, raw: RESUME_AYESHA, quote: 'Containerised the whole stack with Docker and docker-compose for local and CI parity.', reason: 'Hands-on containerisation of services and CI.' }),
  row({ req: 5, label: 'REST API design', importance: 'preferred', status: 'matched', weight: 0.6, score: 1, sim: 0.86, raw: RESUME_AYESHA, quote: 'Wrote the REST API layer consumed by the partner dashboard.', reason: 'Designed and maintained public-facing REST APIs.' }),
  row({ req: 6, label: 'AWS', importance: 'preferred', status: 'partial', weight: 0.5, score: 0.6, sim: 0.62, raw: RESUME_AYESHA, quote: 'AWS Certified Developer - Associate', reason: 'Certification and a skills-list mention; no deployment detail in the resume.' }),
  row({ req: 7, label: "Bachelor's degree in Computer Science", importance: 'required', status: 'matched', weight: 1, score: 1, sim: 0.92, raw: RESUME_AYESHA, quote: 'BS Computer Science - NED University of Engineering and Technology (2015 - 2019)', reason: 'Degree matches the required field.' }),
]

const DANIEL_ROWS: SkillRow[] = [
  row({ req: 1, label: 'Python', importance: 'required', status: 'matched', weight: 1, score: 1, sim: 0.88, raw: RESUME_DANIEL, quote: 'Developer with 3 years of experience in Python web services and relational databases.', reason: 'Three years of Python service work.' }),
  row({ req: 2, label: 'Django', importance: 'required', status: 'not_evidenced', weight: 1, score: 0, sim: null, raw: RESUME_DANIEL, quote: 'Maintained Flask services for patient scheduling and billing.', reason: 'Flask is evidenced, Django is not mentioned anywhere in the resume.', learning: 'Django fundamentals and Django REST Framework would close this gap.' }),
  row({ req: 3, label: 'PostgreSQL', importance: 'required', status: 'not_evidenced', weight: 1, score: 0, sim: null, raw: RESUME_DANIEL, quote: 'Wrote SQL reports against MySQL for the operations team.', reason: 'MySQL is evidenced; PostgreSQL is not named. Adjacent SQL, unconfirmed.' }),
  row({ req: 4, label: 'Docker', importance: 'required', status: 'matched', weight: 1, score: 1, sim: 0.82, raw: RESUME_DANIEL, quote: 'Packaged services with Docker for staging deployments.', reason: 'Container builds for staging.' }),
  row({ req: 5, label: 'REST API design', importance: 'preferred', status: 'matched', weight: 0.6, score: 1, sim: 0.7, raw: RESUME_DANIEL, quote: 'Python, Flask, MySQL, Docker, Git, REST API', reason: 'Listed as a skill with service work behind it.' }),
  row({ req: 6, label: 'AWS', importance: 'preferred', status: 'not_evidenced', weight: 0.5, score: 0, sim: null, raw: RESUME_DANIEL, reason: 'No cloud platform is mentioned.' }),
  row({ req: 7, label: "Bachelor's degree in Computer Science", importance: 'required', status: 'matched', weight: 1, score: 1, sim: 0.85, raw: RESUME_DANIEL, quote: 'BSc Information Technology - University of Ghana (2017 - 2021)', reason: 'Closely related computing degree.' }),
]

const MARCO_ROWS: SkillRow[] = [
  row({ req: 1, label: 'Python', importance: 'required', status: 'partial', weight: 1, score: 0.5, sim: 0.61, raw: RESUME_MARCO, quote: 'Full-stack developer focused on JavaScript products, moving toward backend Python.', reason: 'Python is self-described as basic; no shipped Python service is evidenced.' }),
  row({ req: 2, label: 'Django', importance: 'required', status: 'not_evidenced', weight: 1, score: 0, sim: null, raw: RESUME_MARCO, reason: 'The resume names Express and Node.js, never Django.' }),
  row({ req: 3, label: 'PostgreSQL', importance: 'required', status: 'not_evidenced', weight: 1, score: 0, sim: null, raw: RESUME_MARCO, quote: 'Delivered marketing sites and small Express APIs backed by MongoDB.', reason: 'MongoDB is the only database evidenced.' }),
  row({ req: 4, label: 'Docker', importance: 'required', status: 'matched', weight: 1, score: 1, sim: 0.8, raw: RESUME_MARCO, quote: 'Set up Docker-based preview environments for every pull request.', reason: 'Practical container workflow in CI.' }),
  row({ req: 5, label: 'REST API design', importance: 'preferred', status: 'partial', weight: 0.6, score: 0.5, sim: 0.66, raw: RESUME_MARCO, quote: 'Built React dashboards and Node.js BFF endpoints for fintech clients.', reason: 'BFF endpoints exist, but the API design work is Node.js, not Python.' }),
  row({ req: 6, label: 'AWS', importance: 'preferred', status: 'not_evidenced', weight: 0.5, score: 0, sim: null, raw: RESUME_MARCO }),
  row({ req: 7, label: "Bachelor's degree in Computer Science", importance: 'required', status: 'matched', weight: 1, score: 1, sim: 0.8, raw: RESUME_MARCO, quote: 'BSc Software Engineering - Universidade de Lisboa (2016 - 2020)', reason: 'Software engineering degree satisfies the requirement.' }),
]

const TOMAS_ROWS: SkillRow[] = [
  row({ req: 1, label: 'Python', importance: 'required', status: 'not_evidenced', weight: 1, score: 0, sim: null, raw: RESUME_TOMAS, reason: 'Python does not appear in the resume.' }),
  row({ req: 2, label: 'Django', importance: 'required', status: 'not_evidenced', weight: 1, score: 0, sim: null, raw: RESUME_TOMAS }),
  row({ req: 3, label: 'PostgreSQL', importance: 'required', status: 'confirmed_absent', weight: 1, score: 0, sim: null, raw: RESUME_TOMAS, quote: 'No commercial experience with PostgreSQL yet.', reason: 'The candidate states the absence explicitly, so this is confirmed rather than merely missing.' }),
  row({ req: 4, label: 'Docker', importance: 'required', status: 'confirmed_absent', weight: 1, score: 0, sim: null, raw: RESUME_TOMAS, quote: 'No commercial experience with Docker yet.', reason: 'Explicitly stated on the resume.' }),
  row({ req: 5, label: 'REST API design', importance: 'preferred', status: 'not_evidenced', weight: 0.6, score: 0, sim: null, raw: RESUME_TOMAS }),
  row({ req: 6, label: 'AWS', importance: 'preferred', status: 'not_evidenced', weight: 0.5, score: 0, sim: null, raw: RESUME_TOMAS }),
  row({ req: 7, label: "Bachelor's degree in Computer Science", importance: 'required', status: 'matched', weight: 1, score: 1, sim: 0.83, raw: RESUME_TOMAS, quote: 'BSc Computer Science - Malmo University (2019 - 2023)', reason: 'Degree matches.' }),
]

const AYESHA_FE_ROWS: SkillRow[] = [
  row({ req: 8, label: 'React', importance: 'required', status: 'matched', weight: 1, score: 1, sim: 0.9, raw: RESUME_AYESHA_FE, quote: 'Built the internal design system in React and TypeScript.', reason: 'Design system ownership in React.' }),
  row({ req: 9, label: 'TypeScript', importance: 'required', status: 'matched', weight: 1, score: 1, sim: 0.88, raw: RESUME_AYESHA_FE, quote: 'Five years across React and TypeScript product teams, comfortable owning design systems.', reason: 'Five years of typed product work.' }),
  row({ req: 10, label: 'Tailwind CSS', importance: 'preferred', status: 'matched', weight: 0.5, score: 1, sim: 0.86, raw: RESUME_AYESHA_FE, quote: 'Migrated legacy CSS to Tailwind CSS and documented the component API.', reason: 'Led a migration to Tailwind.' }),
]

const MARCO_FE_ROWS: SkillRow[] = [
  row({ req: 8, label: 'React', importance: 'required', status: 'matched', weight: 1, score: 1, sim: 0.89, raw: RESUME_MARCO, quote: 'Built React dashboards and Node.js BFF endpoints for fintech clients.', reason: 'Production React dashboards.' }),
  row({ req: 9, label: 'TypeScript', importance: 'required', status: 'matched', weight: 1, score: 1, sim: 0.84, raw: RESUME_MARCO, quote: 'JavaScript, TypeScript, Node.js, React, MongoDB, Express, Python (basic), Docker', reason: 'TypeScript listed alongside shipped frontend work.' }),
  row({ req: 10, label: 'Tailwind CSS', importance: 'preferred', status: 'not_evidenced', weight: 0.5, score: 0, sim: null, raw: RESUME_MARCO, reason: 'No styling system is named on the resume.' }),
]

const score = (a: Assessment): Assessment => a

export const ASSESSMENTS: Assessment[] = [
  score({
    id: 1,
    application_id: 1,
    overall: 94,
    skills: 100,
    experience: 100,
    projects: 62,
    qualifications: 100,
    confidence: 'high',
    insufficient_evidence: false,
    ai_mode: 'groq',
    embedding_mode: 'dense',
    model: 'llama-3.3-70b-versatile',
    summary: 'Strong backend match. All four required skills are backed by quoted production evidence, including a PostgreSQL migration and Django APIs at scale.',
    explanation: 'Skills carry the most weight (50%) and every required skill is evidenced. Experience is fully covered by five years against the three-year bar. Project relevance is the weakest dimension: the projects are data-oriented rather than hiring-platform work.',
    created_at: iso(2, 14),
    gaps: [],
    learning_suggestions: [],
    skills_detail: AYESHA_ROWS,
  }),
  score({
    id: 2,
    application_id: 2,
    overall: 67,
    skills: 51,
    experience: 100,
    projects: 46,
    qualifications: 100,
    confidence: 'medium',
    insufficient_evidence: false,
    ai_mode: 'groq',
    embedding_mode: 'dense',
    model: 'llama-3.3-70b-versatile',
    summary: 'Solid Python and Docker evidence with three years of experience. Django and PostgreSQL are not evidenced, which matters because both are required.',
    explanation: 'Two of four required skills are confirmed. The resume shows Flask and MySQL, so the work is adjacent but the specific stack is unproven. No negative inference is drawn from missing mentions.',
    created_at: iso(2, 14),
    gaps: ['Django','PostgreSQL','AWS'],
    learning_suggestions: ['Django REST Framework','PostgreSQL administration','AWS fundamentals'],
    skills_detail: DANIEL_ROWS,
  }),
  score({
    id: 3,
    application_id: 3,
    overall: 55,
    skills: 35,
    experience: 83,
    projects: 45,
    qualifications: 100,
    confidence: 'medium',
    insufficient_evidence: false,
    ai_mode: 'groq',
    embedding_mode: 'dense',
    model: 'llama-3.3-70b-versatile',
    summary: 'Adjacent full-stack profile. JavaScript and Docker are strong; Python is self-rated basic and the database experience is MongoDB.',
    explanation: 'The candidate could grow into the role, but the required Python/Django/PostgreSQL triangle is not yet evidenced. Recommend a screen only if the pipeline thins out.',
    created_at: iso(1, 15),
    gaps: ['Django','PostgreSQL','AWS'],
    learning_suggestions: ['Django','PostgreSQL','AWS fundamentals'],
    skills_detail: MARCO_ROWS,
  }),
  score({
    id: 4,
    application_id: 4,
    overall: 12,
    skills: 0,
    experience: 0,
    projects: 10,
    qualifications: 100,
    confidence: 'low',
    insufficient_evidence: true,
    ai_mode: 'groq',
    embedding_mode: 'dense',
    model: 'llama-3.3-70b-versatile',
    summary: 'Evidence is too thin to score confidently. The resume is a short graduate profile with no backend stack.',
    explanation: 'Fewer than half of the required skills have verified quotes, so the score is shown as a band rather than a precise number.',
    created_at: iso(1, 15),
    gaps: ['Python','Django','PostgreSQL','Docker','REST API design','AWS'],
    learning_suggestions: ['Python backend fundamentals','Django REST Framework','PostgreSQL','Docker'],
    skills_detail: TOMAS_ROWS,
  }),
  score({
    id: 5,
    application_id: 5,
    overall: 86,
    skills: 100,
    experience: 100,
    projects: 70,
    qualifications: 100,
    confidence: 'high',
    insufficient_evidence: false,
    ai_mode: 'groq',
    embedding_mode: 'dense',
    model: 'llama-3.3-70b-versatile',
    summary: 'Design-system ownership in React and TypeScript with a documented Tailwind migration.',
    explanation: 'All required frontend skills are evidenced with quotes.',
    created_at: iso(1, 11),
    gaps: [],
    learning_suggestions: [],
    skills_detail: AYESHA_FE_ROWS,
  }),
  score({
    id: 6,
    application_id: 6,
    overall: 71,
    skills: 80,
    experience: 90,
    projects: 64,
    qualifications: 100,
    confidence: 'medium',
    insufficient_evidence: false,
    ai_mode: 'groq',
    embedding_mode: 'dense',
    model: 'llama-3.3-70b-versatile',
    summary: 'React and TypeScript are well evidenced. No styling system is mentioned.',
    explanation: 'Tailwind is preferred rather than required, so the gap is small.',
    created_at: iso(1, 11),
    gaps: ['Tailwind CSS'],
    learning_suggestions: ['Tailwind CSS'],
    skills_detail: MARCO_FE_ROWS,
  }),
]
