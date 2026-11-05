// FROZEN API CONTRACTS — Agent B owns this file. Agent A: import read-only.
// Changes require a [CONTRACT] board post. Base: http://127.0.0.1:8000/api

export type Role = 'recruiter' | 'candidate';
export type JobStatus = 'open' | 'closed';
export type Stage =
  | 'submitted' | 'parsed' | 'assessed' | 'recruiter_review'
  | 'shortlisted' | 'rejected' | 'interview' | 'selected';
export type SkillStatus = 'matched' | 'partial' | 'not_evidenced' | 'confirmed_absent';
export type Importance = 'required' | 'preferred';
export type AiMode = 'groq' | 'degraded' | 'heuristic';
export type EmbeddingMode = 'dense' | 'lexical';
export type Confidence = 'high' | 'medium' | 'low';

export interface User { id: number; email: string; full_name: string; role: Role; created_at: string }
export interface AuthResponse { token: string; user: User }

export interface Evidence { quote: string; start: number; end: number }

export interface Requirement {
  id: number; kind: 'skill' | 'qualification'; label: string; canonical: string;
  importance: Importance; weight: number; min_years: number | null; evidence_hint: string | null;
}

export interface JobSummary {
  id: number; title: string; department: string; location: string; employment_type: string;
  salary_min: number | null; salary_max: number | null; status: JobStatus;
  created_at: string; updated_at: string;
  applicant_count: number; shortlisted_count: number; interview_count: number;
}
export interface JobDetail extends JobSummary {
  description: string; recruiter_id: number; requirements: Requirement[];
}

export interface ExtractedProfile {
  name: string | null; email: string | null; phone: string | null; links: string[];
  summary: string | null;
  skills: { label: string; canonical: string; quote: string | null; support: 'verified' | 'flagged_unverified' }[];
  experience: { company: string; title: string; start: string | null; end: string | null; months: number | null; summary: string; quote: string | null }[];
  education: { institution: string; degree: string; field: string | null; quote: string | null }[];
  projects: { name: string; description: string; tech: string[]; quote: string | null }[];
  certifications: { name: string; quote: string | null }[];
}

export interface Resume {
  id: number; candidate_id: number; filename: string; mime: string; size_bytes: number;
  page_count: number; parse_status: 'ok' | 'empty' | 'failed'; parse_error: string | null;
  raw_text: string; extracted: ExtractedProfile | null; created_at: string;
}

export interface Score {
  overall: number; skills: number; experience: number; projects: number; qualifications: number;
  confidence: Confidence; insufficient_evidence: boolean;
  ai_mode: AiMode; embedding_mode: EmbeddingMode; model: string;
  /** Dimensions that were NOT scored (e.g. experience when the job sets no year bar).
   *  Their numeric field is 0.0 for backwards compatibility - render them as "not scored". */
  not_measured?: string[];
  /** Weights actually used, renormalised over the measured dimensions. Sums to 1. */
  effective_weights?: Record<string, number>;
}
export interface SkillRow {
  requirement_id: number; label: string; importance: Importance; weight: number;
  status: SkillStatus; score: number; similarity: number | null;
  evidence: Evidence | null; support: 'verified' | 'flagged_unverified'; reason: string;
}
export interface Assessment extends Score {
  id: number; application_id: number; summary: string; explanation: string;
  skills_detail: SkillRow[]; gaps: string[]; learning_suggestions: string[];
  created_at: string;
}

export interface Application {
  id: number; job_id: number; candidate_id: number; resume_id: number;
  stage: Stage; created_at: string; updated_at: string;
  override_score: number | null; override_reason: string | null;
}
export interface ApplicantRow {
  application_id: number; job_id: number; stage: Stage;
  candidate: { id: number; name: string; email: string };
  resume_id: number; resume_filename: string;
  score: Score | null; matched: string[]; missing: string[]; has_notes: boolean;
}
export interface StatusEvent {
  id: number; application_id: number; actor_id: number; actor_name: string;
  from_stage: Stage | null; to_stage: Stage; reason: string | null; created_at: string;
}
export interface Note { id: number; application_id: number; author_name: string; body: string; created_at: string }
export interface ApplicationDetail extends Application {
  job: JobSummary;
  candidate: User;
  resume: Resume | null;
  assessment: Assessment | null;
  events: StatusEvent[]; notes: Note[]; questions: InterviewQuestion[];
  interviews: Interview[];
}

export interface InterviewQuestion {
  id: number; application_id: number; text: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  category: 'skill' | 'project' | 'experience' | 'behavioral';
  guideline: string; source: 'ai' | 'human'; created_at: string;
}

export type InterviewType = 'technical' | 'hr' | 'system_design' | 'panel';
export interface Interview {
  id: number; application_id: number; candidate_name: string; job_title: string;
  scheduled_at: string; duration_min: number; interviewer_id: number; interviewer_name: string;
  interview_type: InterviewType; location: string | null;
  status: 'scheduled' | 'completed' | 'cancelled'; conflict_flag: boolean;
}
export interface ConflictError { detail: string; conflict_with: Interview }
export interface Feedback {
  id: number; interview_id: number; interviewer_name: string; rating: number;
  strengths: string; concerns: string; recommendation: 'strong_yes' | 'yes' | 'no' | 'strong_no'; created_at: string;
}

export interface AnalyticsOverview {
  active_jobs: number; applications: number; shortlisted: number; pending_reviews: number;
  interviews: number; shortlist_rate: number; avg_processing_hours: number;
  by_job: { job_id: number; title: string; applications: number; shortlisted: number; interviews: number }[];
  by_stage: { stage: Stage; count: number }[];
  common_gaps: { skill: string; count: number }[];
}

export interface TalentHit {
  candidate_id: number; name: string; email: string; score: number;
  evidence: { requirement: string; quote: string; similarity: number }[];
  matched: string[]; missing: string[];
}
export interface TalentSearchResult { query: string; mode: EmbeddingMode; hits: TalentHit[]; parsed_requirements: string[] }
export interface CompareRow { candidate_id: number; name: string; score: Score | null; matched: SkillRow[]; missing: SkillRow[]; gaps: string[] }
export interface DuplicatePair { keep: { id: number; name: string; email: string }; duplicate: { id: number; name: string; email: string }; reason: string; similarity: number }
export interface Health { status: string; ai_mode: AiMode; embedding_mode: EmbeddingMode; db: string; model: string }
export interface FairnessAudit {
  passed: boolean; baseline: number; perturbed: number; delta: number;
  checks: { attribute: string; baseline: number; perturbed: number; identical: boolean }[];
  note: string;
}
