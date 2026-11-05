import { useLayoutEffect, type CSSProperties } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { TalentNetwork } from '../components/landing/TalentNetwork'
import { PipelineDemo } from '../components/landing/PipelineDemo'
import { useReveal } from '../components/landing/useReveal'
import '../components/landing/landing.css'

const reveal = (index: number): CSSProperties => ({ '--i': index } as CSSProperties)

const WEIGHTS = [
  { label: 'Skills', weight: 50, points: '47.0', width: '94%' },
  { label: 'Experience', weight: 25, points: '24.5', width: '98%' },
  { label: 'Projects', weight: 15, points: '13.8', width: '92%' },
  { label: 'Qualifications', weight: 10, points: '8.1', width: '81%' },
]

const CANDIDATE_FACTS = [
  [
    'Real parsing, with the sentence attached',
    'Skills come from your own document. Open any one of them and read the line it was taken from.',
  ],
  [
    'Your corrections are kept',
    'Anything the parser missed can be added by hand, and stays alongside the extracted evidence.',
  ],
  [
    'You see the stage a recruiter set',
    'The tracker shows the real stage and its history. The AI never rejects an application on its own.',
  ],
  [
    'Roles matched to verified skills',
    'Recommendations come from what the resume actually supports — not from a keyword count.',
  ],
]

const MODES = [
  ['Extraction', 'LLM · groq', 'Used for this resume, and stored with the assessment.'],
  ['Similarity', 'Dense embeddings', 'Chosen per assessment and named on every requirement row.'],
  ['Fallback', 'Heuristic', 'Labelled when the model degrades — never passed off as AI.'],
]

export function LandingPage() {
  const { user, loading } = useAuth()
  const rootRef = useReveal()

  useLayoutEffect(() => {
    rootRef.current?.classList.add('ready')
  }, [rootRef])

  if (!loading && user) return <Navigate to={user.role === 'recruiter' ? '/recruiter' : '/candidate'} replace />

  return (
    <div className="landing" ref={rootRef}>
      <header className="land-hero">
        <div className="land-wrap">
          <nav className="land-nav" aria-label="Primary">
            <Link to="/" className="land-wordmark">
              Hire Intelligence
            </Link>
            <div className="land-nav__links">
              <a href="#how" className="land-nav__link">
                How it works
              </a>
              <a href="#evidence" className="land-nav__link">
                Evidence
              </a>
              <a href="#fairness" className="land-nav__link">
                Fairness
              </a>
              <a href="#console" className="land-nav__link">
                Console
              </a>
              <a href="#candidates" className="land-nav__link">
                For candidates
              </a>
            </div>
            <div className="land-nav__actions">
              <Link to="/login" className="land-btn land-btn--ghost-light">
                Sign in
              </Link>
              <Link to="/register" className="land-btn land-btn--light">
                Create account
              </Link>
            </div>
          </nav>
        </div>

        <div className="land-wrap land-hero__body">
          <h1 className="land-hero__title">
            <span className="line">
              <span style={reveal(0)}>Hire for evidence,</span>
            </span>
            <span className="line">
              <span style={reveal(1)}>not keywords.</span>
            </span>
          </h1>

          <div className="land-hero__copy">
            <p className="land-hero__lead land-hero__rise" style={reveal(0)}>
              A recruitment console where every AI score decomposes into weighted criteria — and every
              criterion points back to the sentence in the resume that supports it. Missing evidence is
              shown as missing, never as failure.
            </p>

            <div className="land-hero__actions land-hero__rise" style={reveal(1)}>
              <Link to="/login" className="land-btn land-btn--light">
                Open the recruiter console
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link to="/register" className="land-btn land-btn--ghost-light">
                Apply as a candidate
              </Link>
            </div>

          </div>

          <div className="land-hero__art land-hero__rise" style={reveal(2)}>
            <TalentNetwork />
          </div>

          <ul className="land-hero__facts land-hero__rise" style={reveal(3)}>
            <li>Four weighted dimensions</li>
            <li>Every score opens its quote</li>
            <li>Humans make the call</li>
          </ul>
        </div>
      </header>

      <section id="how" className="land-section land-section--white">
        <div className="land-wrap">
          <div className="land-pipeline__head">
            <h2 className="land-h2 reveal" data-reveal style={reveal(0)}>
              The whole decision, on the record.
            </h2>
            <p className="land-lead reveal" data-reveal style={reveal(1)}>
              Six stages, from raw PDF to a signed-off decision. Open any stage to see the evidence it
              leaves behind.
            </p>
          </div>

          <div className="reveal" data-reveal style={reveal(2)}>
            <PipelineDemo />
          </div>

          <p className="reveal" data-reveal style={{ ...reveal(3), marginTop: 28 }}>
            <Link to="/login" className="land-link" style={{ color: 'var(--l-accent)', fontSize: 16 }}>
              Walk the pipeline with the seeded demo recruiter
            </Link>
          </p>
        </div>
      </section>

      <section id="evidence" className="land-section land-section--paper">
        <div className="land-wrap">
          <div className="land-proof__head">
            <h2 className="land-h2 reveal" data-reveal style={reveal(0)}>
              Honest by construction.
            </h2>
            <p className="land-lead reveal" data-reveal style={reveal(1)}>
              Every score shows its working — the criteria, the weights, and the parts it could not
              measure.
            </p>
          </div>

          <div className="land-proof__rows">
            <div className="land-proof__row reveal" data-reveal>
              <div>
                <h3>Weighted, never guessed.</h3>
                <p>
                  Each dimension is scored on its own, then weighted into the final number. A strong skill
                  match cannot quietly cover a thin experience record.
                </p>
              </div>
              <div className="land-proof__visual">
                <p className="land-bars__cap">Points earned out of each weight.</p>
                <div className="land-bars">
                  {WEIGHTS.map((row) => (
                    <div key={row.label}>
                      <span>
                        {row.label} <span style={{ color: 'var(--l-faint)' }}>{row.weight}</span>
                      </span>
                      <i style={{ width: row.width }} />
                      <em>
                        {row.points}
                        <span> / {row.weight}</span>
                      </em>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="land-proof__row land-proof__row--flip reveal" data-reveal>
              <div>
                <h3>Missing evidence is not absence.</h3>
                <p>
                  A requirement with no supporting sentence is labelled missing evidence. The score drops,
                  but the candidate is never called unqualified for something the parser could not find.
                </p>
              </div>
              <div className="land-proof__visual">
                <div className="land-missing" data-ui>
                  <div className="land-missing__top">
                    <strong>Kubernetes · required</strong>
                    <span>Missing evidence</span>
                  </div>
                  <p>
                    No supporting sentence was found in this resume. Add a manual confirmation, or ask
                    about it in the interview.
                  </p>
                </div>
              </div>
            </div>

            <div className="land-proof__row reveal" data-reveal>
              <div>
                <h3>Every AI mode is labelled.</h3>
                <p>
                  Each assessment records the path that produced it — LLM extraction or heuristic
                  fallback, dense or lexical similarity. When a dimension could not be measured, it says
                  so instead of showing a zero.
                </p>
              </div>
              <div className="land-proof__visual">
                <div className="land-audit">
                  {MODES.map(([label, mode, note]) => (
                    <div className="land-audit__row" key={label}>
                      <span>{label}</span>
                      <div>
                        <b>{mode}</b>
                        <div>
                          <span>{note}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="fairness" className="land-section land-fairness">
        <div className="land-wrap">
          <div className="land-fairness__head">
            <h2 className="reveal" data-reveal style={reveal(0)}>
              Same resume. Same score.
            </h2>
            <p className="reveal" data-reveal style={reveal(1)}>
              Name, gender, age and nationality are stripped before scoring. The fairness audit re-runs
              the same resume with them swapped, and keeps both results.
            </p>
          </div>
          <div className="land-fairness__scores">
            <div className="land-fairness__col reveal" data-reveal style={reveal(0)}>
              <b>93.4</b>
              <p>Original resume · Ayesha Khan</p>
            </div>
            <div className="land-fairness__col reveal" data-reveal style={reveal(1)}>
              <b>93.4</b>
              <p>Protected fields swapped · Candidate A</p>
            </div>
          </div>
          <div className="land-fairness__ledger reveal" data-reveal style={reveal(2)}>
            <div>
              <span>Baseline assessment</span>
              <b>93.4</b>
            </div>
            <div>
              <span>Protected fields swapped</span>
              <b>93.4</b>
            </div>
            <div>
              <span>Difference</span>
              <b>0.0</b>
            </div>
          </div>
          <p className="land-fairness__note reveal" data-reveal style={reveal(3)}>
            Illustrative run. In the console the audit stores both assessments, so the comparison stays
            inspectable instead of being a claim in a footer.
          </p>
        </div>
      </section>

      <section id="console" className="land-section land-section--ink">
        <div className="land-wrap">
          <div className="land-product__head">
            <h2 className="land-h2 reveal" data-reveal style={reveal(0)}>
              Inside the console.
            </h2>
            <p className="land-lead reveal" data-reveal style={reveal(1)}>
              These are screenshots from the running application — the same screens the demo accounts
              open.
            </p>
          </div>

          <div className="land-product__mosaic">
            <figure className="land-shot land-shot--drift reveal" data-reveal style={{ ...reveal(0), margin: 0 }}>
              <img
                src="/landing/console-ranked-list.png"
                width={1440}
                height={950}
                loading="lazy"
                decoding="async"
                alt="The applicants screen: four candidates ranked with scores, skill tags and strong, partial or insufficient-evidence labels."
              />
              <figcaption className="land-shot__cap">
                <b>Applicants, ranked by evidence</b>
                <span>Strong, partial and insufficient-evidence states</span>
              </figcaption>
            </figure>

            <div className="land-product__mosaic--2">
              <figure
                className="land-shot land-shot--crop reveal"
                data-reveal
                style={{ ...reveal(1), margin: 0 }}
              >
                <img
                  src="/landing/console-evidence.png"
                  width={1440}
                  height={1688}
                  loading="lazy"
                  decoding="async"
                  alt="An application detail screen showing each requirement with the quoted resume sentence and its weighted contribution."
                />
                <figcaption className="land-shot__cap">
                  <b>Evidence per requirement</b>
                  <span>Quote, weight, and similarity</span>
                </figcaption>
              </figure>

              <figure
                className="land-shot land-shot--crop reveal"
                data-reveal
                style={{ ...reveal(1), margin: '18px 0 0' }}
              >
                <img
                  src="/landing/not-measured.png"
                  width={1440}
                  height={1100}
                  loading="lazy"
                  decoding="async"
                  alt="An application detail screen marking dimensions that could not be measured instead of scoring them as zero."
                />
                <figcaption className="land-shot__cap">
                  <b>Not measured, said plainly</b>
                  <span>No silent zeros</span>
                </figcaption>
              </figure>
            </div>
          </div>
        </div>
      </section>

      <section id="candidates" className="land-section land-section--white">
        <div className="land-wrap land-cand">
          <div>
            <h2 className="land-h2 reveal" data-reveal style={reveal(0)}>
              Your resume is the source of truth.
            </h2>
            <p className="land-lead reveal" data-reveal style={reveal(1)}>
              Upload a PDF or DOCX, correct anything the parser missed, and apply with the document you
              choose. You see the same evidence the recruiter sees.
            </p>

            <ul className="land-cand__list">
              {CANDIDATE_FACTS.map(([title, body], index) => (
                <li key={title} className="reveal" data-reveal style={reveal(index)}>
                  <div>
                    <b>{title}</b>
                    <span>{body}</span>
                  </div>
                </li>
              ))}
            </ul>

            <div className="reveal" data-reveal style={{ ...reveal(2), marginTop: 28 }}>
              <Link to="/register" className="land-btn land-btn--blue">
                Create a candidate account
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>

          <div className="land-cand__visual reveal" data-reveal style={reveal(1)}>
            <div className="land-cand__shot">
              <img
                src="/landing/candidate-resume.png"
                width={1440}
                height={950}
                loading="lazy"
                decoding="async"
                alt="The candidate resume screen, showing the uploaded document and the skills parsed from it."
              />
            </div>
            <div className="land-cand__float">
              <p>
                <b>Every parsed skill keeps its sentence.</b> Correct the extraction and the correction
                sits beside the original, not on top of it.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="land-section land-cta">
        <div className="land-wrap land-cta__inner">
          <h2 className="reveal" data-reveal style={reveal(0)}>
            Bring a resume.
            <br />
            Read the evidence.
          </h2>
          <div className="land-cta__actions reveal" data-reveal style={reveal(1)}>
            <Link to="/login" className="land-btn land-btn--light">
              Open the recruiter console
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link to="/register" className="land-btn land-btn--outline-light">
              Create an account
            </Link>
          </div>
          <p className="land-cta__note reveal" data-reveal style={reveal(2)}>
            Seeded demo accounts — <b>recruiter@hire.dev</b> and <b>candidate@hire.dev</b>. The password
            is <b>demo1234</b>, and one click fills the sign-in form.
          </p>
        </div>
      </section>

      <footer className="land-footer">
        <div className="land-wrap land-footer__inner">
          <div className="land-footer__top">
            <h2>Hire Intelligence</h2>
            <div className="land-footer__links">
              <Link to="/login">Sign in</Link>
              <Link to="/register">Create account</Link>
              <Link to="/candidate/jobs">Open roles</Link>
            </div>
          </div>
          <div className="land-footer__bottom">
            <span>Evidence-first recruitment and talent intelligence.</span>
            <span>Screenshots are captured from the running application.</span>
            <span>R S C I Web Development Competition · 2026</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
