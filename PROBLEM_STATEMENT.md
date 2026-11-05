# WEB APP DEVELOPMENT — Official Problem Statement (verbatim)

> Original supplied by the organizers. Preserved as given; only OCR ligature characters repaired (e.g. `pla�orm` → `platform`). **This file is the primary implementation specification** and overrides any assumption made before it was released.

## General Instructions

- This task is not bound to any specific language either on a front-end or back-end (use any suitable technology stack for the web applications).
- Detailed Evaluation Rubrics of Web Development are mentioned below.
- Try to write clean code which can be easily understandable.
- Try to schedule your activities w.r.t to your specified time limit (Late Submission will not be evaluated)

---

# RECRUITMENT & TALENT INTELLIGENCE PLATFORM

## 1. Overview

Develop an AI-powered recruitment platform that helps recruiters publish jobs, process resumes, evaluate job-related qualifications, shortlist applicants, schedule interviews, and understand recruitment activity. The system should use semantic matching and explainable recommendations rather than simple keyword matching. Hiring decisions must remain under human control.

## 2. User Roles

- **Recruiter:** manages vacancies, reviews candidates, shortlists applications, schedules interviews, and views analytics.
- **Candidate:** maintains a profile, uploads a resume, applies for jobs, and tracks application status.

## 3. Detailed Functional Requirements

### 3.1 Authentication & Access Control

- Recruiter and candidate registration, login and logout.
- Role-based dashboards and authorization. Candidates cannot access recruiter-only information.
- Secure password handling, session management and input validation.

### 3.2 Job Posting & Management

- Create/edit/close/reopen jobs with title, department, location, type, salary and description.
- Specify required/preferred skills, experience, qualifications and skill importance.
- List vacancies with applicant counts, AI extraction of requirements from free-text descriptions.

### 3.3 Resume Upload & Parsing

- Upload PDF resumes, DOCX support is optional.
- Extract name, contact information, skills, education, relevant experience and projects.
- Normalize equivalent terms (e.g. JS and JavaScript), store structured results, and permit candidate corrections.
- Handle unsupported documents, empty resumes and parsing failures gracefully.

### 3.4 Candidate Matching

- Compare candidate evidence with job requirements using semantic similarity, not only exact keywords.
- Produce an explainable job-relevance score with matched skills, gaps and supporting evidence.
- Rank applicants for recruiter review and allow manual filters and overrides.
- Suggested weighted scoring: skills 50%, experience 25%, project relevance 15%, qualifications 10%. teams may justify alternatives.

### 3.5 Skill Gap & Explainability

- Distinguish missing evidence from confirmed absence of a skill.
- Show supporting resume excerpts and explain each recommendation.
- Suggest learning areas, allow recruiters to correct extracted skills.

### 3.6 Application Pipeline

- Candidates submit applications and view their status.
- Recruiters view, shortlist, reject or advance candidates manually and add private notes.
- Maintain an audit trail of status changes.
- Suggested states: Submitted → Parsed → AI Assessment Available → Recruiter Review → Shortlisted/Rejected → Interview → Selected/Rejected.

### 3.7 Interview Question Generation

- Generate role-specific questions with beginner/intermediate/advanced difficulty.
- Create questions about candidate projects and provide answer guidelines.
- Allow recruiters to edit, remove and regenerate questions.

### 3.8 Interview Scheduling & Feedback

- Schedule date, time, interviewer and interview type, show interview schedules.
- Flag scheduling conflicts, store structured interviewer feedback.
- Permit authorized recruiters to record final decisions, notifications may be simulated.

### 3.9 Recruitment Analytics

- Display active jobs, applications, shortlisted candidates, pending reviews and interviews.
- Charts by job and stage, application-to-shortlist rate and average processing time.
- Identify common job-related skill gaps across applicants.

### 3.10 Advanced Talent Intelligence

- **Natural-language talent search:** Recruiters enter queries such as "Python developers with REST API experience". The system returns matching applicants with supporting resume evidence.
- **Semantic resume search:** Index resume text using embeddings and retrieve relevant candidates even when their wording differs from the search query.
- **Duplicate application detection:** Identify likely duplicate candidate records using normalized contact details and document similarity; allow human confirmation before merging.
- **Resume-to-job recommendations:** Recommend open vacancies to candidates using their verified skills, interests, and relevant project experience.
- **Talent pool discovery:** Search previously reviewed applicants when a new job is published, respecting access permissions and data retention.
- **Candidate comparison:** Show side-by-side job-related evidence, missing information, and score explanations for selected applicants.
- **Fairness and bias safeguards:** Exclude protected or irrelevant personal characteristics from scoring, test whether changing such attributes affects recommendations.
- **AI hallucination verification:** Link extracted skills and generated claims to actual resume excerpts, flag unsupported assertions for manual review.

## 4. Technical Scope — Summary

Any technology stack is allowed. Suggested choices: React/Next.js frontend, FastAPI, Django, Node.js or Rails backend. PostgreSQL/MySQL/MongoDB. PyMuPDF/pdfplumber for parsing. OpenAI/Gemini/local LLM or Sentence Transformers for AI. FAISS/ChromaDB/pgvector for semantic retrieval. **Hardcoded AI responses do not count as implemented AI features.**

## 5. Evaluation Rubric (100 Marks)

| Criterion | Marks |
|---|---|
| Architecture & Functional completeness | 30 |
| AI implementation & matching quality | 25 |
| Resume parsing & extraction | 15 |
| UI & experience | 15 |
| Innovation, Testing, Security & Deployment | 15 |
| **TOTAL** | **100** |

## 6. Final Demonstration Scenario

A recruiter posts a Backend Developer vacancy requiring Python, Django, PostgreSQL and Docker. Three candidates apply with resumes. The system extracts evidence, produces job-relevance scores with explanations, identifies missing evidence, and presents candidates for human review. The recruiter shortlists one applicant, generates interview questions, schedules an interview, and sees the dashboard update.

**Success criterion:** a reliable end-to-end workflow, meaningful AI functionality, transparent evidence-based recommendations, and solid engineering, not merely the greatest number of features.

--- Best of Luck ---
