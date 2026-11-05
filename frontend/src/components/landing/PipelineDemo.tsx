import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

type Stage = {
  label: string
  hint: string
  title: string
  body: string
  fragment: ReactNode
}

const STAGES: Stage[] = [
  {
    label: 'Parse',
    hint: 'Extract evidence',
    title: 'Resumes are parsed, not skimmed.',
    body: 'A PDF or DOCX goes through text extraction and an LLM extractor. Every skill, role and qualification comes back with the sentence it was taken from.',
    fragment: (
      <>
        <p className="ev-quote is-relative">
          “Tuned 40+ PostgreSQL indexes and cut p95 query latency from 340ms to 90ms on the billing
          service.”
        </p>
        <div className="ev-meta">
          <span>PostgreSQL · required</span>
          <span>Quoted from page 1</span>
        </div>
      </>
    ),
  },
  {
    label: 'Assess',
    hint: 'Weight four criteria',
    title: 'Four weights, printed on every score.',
    body: 'Skills carry 50 points, experience 25, project relevance 15 and qualifications 10. Each dimension reports what it measured and what it could not.',
    fragment: (
      <div className="ev-bars">
        <div>
          <span>Skills</span>
          <i style={{ width: '94%' }} />
          <em>47.0</em>
        </div>
        <div>
          <span>Experience</span>
          <i style={{ width: '98%' }} />
          <em>24.5</em>
        </div>
        <div>
          <span>Projects</span>
          <i style={{ width: '92%' }} />
          <em>13.8</em>
        </div>
        <div>
          <span>Qualifications</span>
          <i style={{ width: '81%' }} />
          <em>8.1</em>
        </div>
      </div>
    ),
  },
  {
    label: 'Rank',
    hint: 'Order the list',
    title: 'A ranking you can read line by line.',
    body: 'Applicants are ordered by evidence, not applicant count. Strong, partial and insufficient-evidence states are labelled instead of blurred into one number.',
    fragment: (
      <div className="ev-rows">
        <div className="ev-row">
          <span className="ev-row__who">
            <b>Ayesha Khan</b>
            <span>Strong match</span>
          </span>
          <span className="ev-row__score">
            95.5<em>/ 100</em>
          </span>
        </div>
        <div className="ev-row">
          <span className="ev-row__who">
            <b>Bilal Ahmed</b>
            <span>Partial match</span>
          </span>
          <span className="ev-row__score">
            46.0<em>/ 100</em>
          </span>
        </div>
        <div className="ev-row">
          <span className="ev-row__who">
            <b>Sana Iqbal</b>
            <span>Insufficient evidence</span>
          </span>
          <span className="ev-row__score">
            43.0<em>/ 100</em>
          </span>
        </div>
      </div>
    ),
  },
  {
    label: 'Shortlist',
    hint: 'Human decision',
    title: 'The recruiter moves the candidate.',
    body: 'Shortlisting is a human action that asks for a reason. The candidate moves stage and the reason is written to the record in the same step.',
    fragment: (
      <>
        <span className="ev-stage">
          Stage <em>AI assessed</em> → <b>Shortlisted</b>
        </span>
        <p className="ev-check" style={{ marginTop: 14 }}>
          <b>Reason recorded:</b> “PostgreSQL depth maps directly to the billing-service requirement;
          infrastructure ownership is the gap to probe in the interview.”
        </p>
        <div className="ev-meta">
          <span>Rehan Abrar · recruiter</span>
          <span>Audit entry written</span>
        </div>
      </>
    ),
  },
  {
    label: 'Interview',
    hint: 'Check the calendar',
    title: 'A slot is checked before it is offered.',
    body: 'Interview scheduling reads the interviewer’s existing bookings. An overlapping slot is reported as a conflict instead of silently double-booking the panel.',
    fragment: (
      <>
        <span className="ev-stage">
          Tue 14:00–14:45 <em>· Ayesha Khan · Backend Developer</em>
        </span>
        <p className="ev-check" style={{ marginTop: 14 }}>
          <b>Conflict check:</b> the 14:30 slot on the same day overlaps an existing interview and is
          refused. The dialog stays open with the reason, so the recruiter can pick another time.
        </p>
        <div className="ev-meta">
          <span>Interviewer: Rehan Abrar</span>
          <span>Calendar checked</span>
        </div>
      </>
    ),
  },
  {
    label: 'Decide',
    hint: 'Keep the record',
    title: 'Every decision leaves a trail.',
    body: 'Notes, overrides and stage changes are kept with the actor and the reason. The fairness audit re-runs the same resume with protected fields swapped.',
    fragment: (
      <div className="ev-steps">
        <div className="ev-step">
          <span className="ev-step__t">09:42</span>
          <span className="ev-step__b">
            <b>Rehan Abrar</b> shortlisted — reason recorded
          </span>
        </div>
        <div className="ev-step">
          <span className="ev-step__t">09:51</span>
          <span className="ev-step__b">
            <b>AI assessment</b> overall 95.5 · groq extraction · dense similarity
          </span>
        </div>
        <div className="ev-step">
          <span className="ev-step__t">10:04</span>
          <span className="ev-step__b">
            <b>Fairness audit</b> identical score after protected fields were swapped
          </span>
        </div>
      </div>
    ),
  },
]

export function PipelineDemo() {
  const [active, setActive] = useState(0)
  const tabs = useRef<Array<HTMLButtonElement | null>>([])
  const stage = STAGES[active]

  const move = (event: KeyboardEvent<HTMLButtonElement>) => {
    let next = active
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (active + 1) % STAGES.length
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (active - 1 + STAGES.length) % STAGES.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = STAGES.length - 1
    else return
    event.preventDefault()
    setActive(next)
    tabs.current[next]?.focus()
  }

  return (
    <div className="land-pipeline">
      <div className="land-pipeline__stages" role="tablist" aria-label="Hiring pipeline stages">
        {STAGES.map((item, index) => (
          <button
            key={item.label}
            ref={(node) => {
              tabs.current[index] = node
            }}
            type="button"
            role="tab"
            id={`stage-tab-${index}`}
            aria-selected={index === active}
            aria-controls="stage-panel"
            tabIndex={index === active ? 0 : -1}
            className="land-pipeline__stage"
            onClick={() => setActive(index)}
            onKeyDown={move}
          >
            <b>{item.label}</b>
            <span>{item.hint}</span>
          </button>
        ))}
      </div>

      <div className="land-pipeline__panel" id="stage-panel" role="tabpanel" aria-labelledby={`stage-tab-${active}`}>
        <div className="land-pipeline__panel-in" key={active}>
          <div>
            <h3>{stage.title}</h3>
            <p>{stage.body}</p>
          </div>
          <div data-ui>{stage.fragment}</div>
        </div>
      </div>
    </div>
  )
}
