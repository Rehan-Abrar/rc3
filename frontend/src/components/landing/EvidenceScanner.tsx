import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

type Requirement = {
  label: string
  match: number
  points: number
  line: string
  quote: string
}

const REQUIREMENTS: Requirement[] = [
  {
    label: 'PostgreSQL',
    match: 94,
    points: 47,
    line: 'Line 12 · Work experience',
    quote:
      'Tuned 40+ PostgreSQL indexes and cut p95 query latency from 340ms to 90ms on the billing service.',
  },
  {
    label: 'Python',
    match: 91,
    points: 45.5,
    line: 'Line 9 · Work experience',
    quote:
      'Built the ingestion pipeline in Python — async workers, typed schemas and retries for 40+ event types.',
  },
  {
    label: 'Docker',
    match: 78,
    points: 39,
    line: 'Line 15 · Work experience',
    quote:
      'Containerised the API and worker queue with Docker Compose, cutting deploy time to under 90 seconds.',
  },
]

const OTHER_DIMENSIONS = 24.5 + 13.8 + 8.1
const BAR_WIDTHS = ['50%', '25%', '15%', '10%']

function useTilt() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)')
    if (reduced.matches || !fine.matches || window.innerWidth < 1024) return

    let frame = 0
    const onMove = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect()
      const x = (event.clientX - rect.left) / rect.width - 0.5
      const y = (event.clientY - rect.top) / rect.height - 0.5
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        el.style.setProperty('--rx', `${(y * -5).toFixed(2)}deg`)
        el.style.setProperty('--ry', `${(x * 7).toFixed(2)}deg`)
      })
    }
    const onLeave = () => {
      cancelAnimationFrame(frame)
      el.style.setProperty('--rx', '0deg')
      el.style.setProperty('--ry', '0deg')
    }

    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)
    return () => {
      cancelAnimationFrame(frame)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  return ref
}

export function EvidenceScanner() {
  const [active, setActive] = useState(0)
  const tabs = useRef<Array<HTMLButtonElement | null>>([])
  const tilt = useTilt()
  const req = REQUIREMENTS[active]
  const total = (req.points + OTHER_DIMENSIONS).toFixed(1)

  const move = (event: KeyboardEvent<HTMLButtonElement>) => {
    let next = active
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (active + 1) % REQUIREMENTS.length
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (active - 1 + REQUIREMENTS.length) % REQUIREMENTS.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = REQUIREMENTS.length - 1
    else return
    event.preventDefault()
    setActive(next)
    tabs.current[next]?.focus()
  }

  return (
    <div className="land-scan">
      <div className="land-scan__tabs" role="tablist" aria-label="Requirement evidence">
        {REQUIREMENTS.map((item, index) => (
          <button
            key={item.label}
            ref={(node) => {
              tabs.current[index] = node
            }}
            type="button"
            role="tab"
            id={`requirement-tab-${index}`}
            aria-selected={index === active}
            aria-controls="requirement-evidence"
            tabIndex={index === active ? 0 : -1}
            className="land-scan__tab"
            onClick={() => setActive(index)}
            onKeyDown={move}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="land-scan__tilt" ref={tilt}>
        <div
          className="land-scan__stack"
          data-ui
          id="requirement-evidence"
          role="tabpanel"
          aria-labelledby={`requirement-tab-${active}`}
        >
          <div className="land-scan__doc">
            <div className="land-scan__scanline" key={active} aria-hidden="true" />
            <div className="land-scan__doc-head">
              <span className="land-scan__name">Ayesha Khan</span>
              <span className="land-scan__role">Backend Developer · 4 years</span>
            </div>
            <p className="land-scan__doc-line">
              FinReach Payments — backend engineer on the billing platform. Python, FastAPI, PostgreSQL,
              Docker, event-driven services.
            </p>
            <p className="land-scan__quote">
              “{req.quote}”
              <span className="land-scan__quote-meta">
                <span>{req.line}</span>
                <span>Quoted from the uploaded PDF</span>
              </span>
            </p>
          </div>

          <div className="land-scan__card">
            <div className="land-scan__card-top">
              <span className="land-scan__req">{req.label} · required</span>
              <span className="land-scan__score">
                <b>{req.match}%</b>
                <span>match</span>
              </span>
            </div>
            <p className="land-scan__match-note">
              Cosine similarity between this requirement and the quoted sentence. It explains the match;
              it never makes the hiring decision.
            </p>
            <div className="land-scan__weights" aria-hidden="true">
              {BAR_WIDTHS.map((width, index) => (
                <span key={index} style={{ width }} />
              ))}
            </div>
            <div className="land-scan__weight-labels">
              <span>Skills 50</span>
              <span>Experience 25</span>
              <span>Projects 15</span>
              <span>Qualifications 10</span>
            </div>
            <div className="land-scan__total">
              <span>
                Skills contributes <b>{req.points.toFixed(1)}</b> of 50
              </span>
              <span>
                Example overall score <b>{total}</b>
              </span>
            </div>
          </div>
        </div>
      </div>

      <p className="land-scan__caption">
        Sampled from the seeded demo candidate. Switch requirements above to see the sentence each score
        points back to.
      </p>
    </div>
  )
}
