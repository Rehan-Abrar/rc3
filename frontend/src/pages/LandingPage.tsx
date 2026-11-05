import { Link, Navigate } from 'react-router-dom'
import { ArrowRight, BadgeCheck, FileSearch, Gauge, ShieldCheck, Sparkles, Users } from 'lucide-react'
import { useAuth } from '../lib/auth'

const STEPS = [
  {
    code: '01',
    title: 'Resumes are parsed, not skimmed',
    body: 'PDF or DOCX goes through PyMuPDF and an LLM extractor. Every skill, role and qualification comes back with the sentence it was taken from.',
    icon: FileSearch,
  },
  {
    code: '02',
    title: 'Scores are weighted and quoted',
    body: 'Skills 50, experience 25, project relevance 15, qualifications 10. Each requirement shows matched, partial or missing evidence — never a guess.',
    icon: Gauge,
  },
  {
    code: '03',
    title: 'A human decides',
    body: 'Shortlist, reject, override, schedule, record feedback. Every action is written to an audit trail with the actor and the reason.',
    icon: Users,
  },
]

const FACTS = [
  ['Protected attributes dropped', 'Name, gender, age and nationality are stripped before scoring; the fairness audit re-runs the same resume with those fields swapped.'],
  ['Missing evidence is not absence', 'A requirement with no supporting sentence is labelled missing evidence. Only explicit statements or a recruiter mark it confirmed absent.'],
  ['AI mode is always visible', 'Every assessment shows whether extraction ran with the LLM, fell back to heuristics, or degraded — and which embedding path produced the similarity.'],
]

export function LandingPage() {
  const { user, loading } = useAuth()
  if (!loading && user) return <Navigate to={user.role === 'recruiter' ? '/recruiter' : '/candidate'} replace />

  return (
    <div className="min-h-screen bg-surface">
      <nav className="sticky top-0 z-40 border-b border-line border-t-[2.5px] border-t-accent bg-surface">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-8">
          <Link to="/" className="shrink-0 font-display text-[17px] font-medium tracking-tight text-accent">
            Match.Wise
          </Link>
          <div className="hidden flex-1 items-center gap-5 md:flex">
            {[
              ['How it works', '#how'],
              ['For recruiters', '#recruiters'],
              ['For candidates', '#candidates'],
              ['AI & fairness', '#fairness'],
            ].map(([label, href]) => (
              <a key={href} href={href} className="body-copy text-[13px] text-ink/75 transition-colors hover:text-accent">
                {label}
              </a>
            ))}
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Link to="/login" className="border border-line px-3 py-2 body-copy text-xs font-medium text-ink transition-colors hover:border-accent/40 hover:text-accent">
              Sign in
            </Link>
            <Link to="/register" className="bg-accent px-3 py-2 body-copy text-xs font-medium text-accent-ink transition-colors hover:bg-accent/88">
              Create account
            </Link>
          </div>
        </div>
      </nav>

      <section className="bg-accent px-4 py-14 text-accent-ink sm:px-8 sm:py-20">
        <div className="mx-auto flex max-w-6xl flex-col gap-10 lg:flex-row lg:items-start lg:gap-12">
          <div className="lg:w-[58%]">
            <span className="inline-block bg-ink px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-white/85">
              [ AI-powered · human-controlled ]
            </span>
            <h1 className="mt-5 font-display text-[clamp(40px,7vw,76px)] font-light leading-[1.02] tracking-[-0.03em] text-white">
              Hire for evidence,
              <br />
              not keywords.
            </h1>
            <div className="mt-7 flex flex-wrap gap-2">
              <Link to="/login" className="inline-flex h-10 items-center gap-2 bg-white px-5 body-copy text-sm font-medium text-accent transition-colors hover:bg-white/90">
                Open the recruiter console <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link to="/register" className="inline-flex h-10 items-center gap-2 border border-white/40 px-5 body-copy text-sm font-medium text-white transition-colors hover:bg-white/10">
                Apply as a candidate
              </Link>
            </div>
            <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.1em] text-white/60">
              Seeded demo accounts · one click fills the form
            </p>
            <ul className="mt-8 space-y-2 border-t border-white/15 pt-5">
              {[
                'Every score decomposes into four weighted dimensions',
                'Every requirement can be expanded to its resume sentence',
                'Every stage change is recorded with actor and reason',
              ].map((line) => (
                <li key={line} className="flex items-start gap-2 body-copy text-[12px] leading-relaxed text-white/70">
                  <span className="mt-1.5 h-1 w-1 shrink-0 bg-white/60" aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:flex-1">
            <p className="max-w-md body-copy text-[15px] leading-relaxed text-white/85">
              A recruitment and talent-intelligence platform where every AI score is broken into weighted evidence and tied to a
              sentence in the resume. Missing skills are shown as missing — never as failure.
            </p>
            <div className="mt-6 grid grid-cols-3 gap-px border border-white/20 bg-white/20 sm:grid-cols-6">
              {['Parse', 'Assess', 'Rank', 'Shortlist', 'Interview', 'Decide'].map((step) => (
                <span key={step} className="bg-white/10 px-1 py-1.5 text-center font-ui text-[9px] font-semibold uppercase tracking-[0.08em] text-white">
                  {step}
                </span>
              ))}
            </div>
            <div className="mt-7 border border-white/25 bg-white p-4 text-ink">
              <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-faint">[ Example evidence row ]</p>
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                <p className="body-copy text-xs font-semibold">PostgreSQL · required</p>
                <span className="inline-flex items-center gap-1 border border-good/25 bg-good/8 px-1.5 py-0.5 font-ui text-[10px] font-medium uppercase tracking-[0.06em] text-good">
                  <BadgeCheck className="h-3 w-3" /> Matched · 94%
                </span>
              </div>
              <p className="mt-2 border-l-2 border-accent bg-canvas py-2 pl-3 pr-2 body-copy text-[11px] leading-relaxed text-ink/85">
                “Tuned 40+ PostgreSQL indexes and cut p95 query latency from 340ms to 90ms on the billing service.”
              </p>
              <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.08em] text-faint">
                Verified against resume text · dense embeddings
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="border-b border-line px-4 py-14 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <p className="bracket-blue">[ How it works ]</p>
          <h2 className="display mt-2 max-w-2xl text-[clamp(26px,3.4vw,38px)] leading-[1.1]">
            Three steps, all of them inspectable.
          </h2>
          <div className="mt-8 grid gap-0 border border-line md:grid-cols-3 md:divide-x md:divide-line">
            {STEPS.map((s) => (
              <div key={s.code} className="border-b border-line px-5 py-6 last:border-b-0 md:border-b-0">
                <div className="flex items-center justify-between">
                  <s.icon className="h-5 w-5 text-accent" aria-hidden />
                  <span className="font-mono text-[10px] text-faint">{s.code}</span>
                </div>
                <h3 className="mt-3 font-display text-[17px] font-medium leading-snug text-ink">{s.title}</h3>
                <p className="mt-2 body-copy text-[13px] leading-relaxed text-muted">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="recruiters" className="border-b border-line bg-canvas px-4 py-14 sm:px-8 sm:py-16">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_1fr] lg:gap-12">
          <div>
            <p className="bracket-blue">[ For recruiters ]</p>
            <h2 className="display mt-2 text-[clamp(24px,3vw,34px)] leading-[1.15]">Ranked applicants you can defend in a meeting.</h2>
            <p className="mt-3 max-w-lg body-copy text-sm leading-relaxed text-muted">
              Post a job, let extraction turn the description into a matching contract, then work the ranked list with quoted
              evidence on every requirement. Overrides are recorded with your reason and change the ranking explicitly.
            </p>
            <ul className="mt-5 space-y-2">
              {[
                'Job editor with AI requirement extraction',
                'Applicants ranked by evidence, filterable by stage and score',
                'Private notes, audit trail and human overrides',
                'Interview scheduling with conflict detection',
                'Fairness audit and duplicate candidate merge',
              ].map((line) => (
                <li key={line} className="flex gap-2 body-copy text-[13px] text-muted">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
            <Link to="/login" className="mt-6 inline-flex h-10 items-center gap-2 bg-accent px-5 body-copy text-sm font-medium text-accent-ink transition-colors hover:bg-accent/88">
              Sign in to the console <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <div id="candidates" className="border border-line bg-surface p-6">
            <p className="bracket-blue">[ For candidates ]</p>
            <h2 className="display mt-2 text-[clamp(22px,2.6vw,28px)] leading-[1.15]">Your resume is the source of truth.</h2>
            <p className="mt-3 body-copy text-sm leading-relaxed text-muted">
              Upload a PDF or DOCX, correct anything the parser missed, and apply with the document you choose. You see the exact
              stage a recruiter sets — AI never rejects you automatically.
            </p>
            <ul className="mt-5 space-y-2">
              {[
                'Real parsing with quoted skill evidence',
                'Manual skill corrections kept alongside the extraction',
                'Application tracker with stage history',
                'Roles recommended from your verified skills',
              ].map((line) => (
                <li key={line} className="flex gap-2 body-copy text-[13px] text-muted">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-good" aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
            <Link to="/register" className="mt-6 inline-flex h-10 items-center gap-2 border border-ink/15 px-5 body-copy text-sm font-medium text-ink transition-colors hover:border-accent/40 hover:text-accent">
              Create a candidate account <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      <section id="fairness" className="border-b border-line px-4 py-14 sm:px-8 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <p className="bracket-blue">[ AI &amp; fairness ]</p>
          <h2 className="display mt-2 max-w-2xl text-[clamp(24px,3vw,34px)] leading-[1.15]">Honest by construction, not by promise.</h2>
          <div className="mt-8 grid gap-0 border border-line md:grid-cols-3 md:divide-x md:divide-line">
            {FACTS.map(([title, body]) => (
              <div key={title} className="border-b border-line px-5 py-6 last:border-b-0 md:border-b-0">
                <h3 className="font-display text-[15px] font-medium leading-snug text-ink">{title}</h3>
                <p className="mt-2 body-copy text-[13px] leading-relaxed text-muted">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-ink px-4 py-12 text-white sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-display text-lg font-medium tracking-tight text-white">Match.Wise</p>
            <p className="mt-1 max-w-sm body-copy text-[13px] leading-relaxed text-white/60">
              Evidence-first recruitment and talent intelligence. Built for a hackathon, honest about its modes.
            </p>
          </div>
          <div className="flex flex-wrap gap-6">
            <Link to="/login" className="body-copy text-[13px] text-white/75 hover:text-white">Sign in</Link>
            <Link to="/register" className="body-copy text-[13px] text-white/75 hover:text-white">Create account</Link>
            <Link to="/candidate/jobs" className="body-copy text-[13px] text-white/75 hover:text-white">Open roles</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
