import { useState } from 'react'
import { CalendarPlus, CalendarClock, CheckSquare, MapPin, Star, TriangleAlert } from 'lucide-react'
import { interviewApi } from '../../lib/api'
import type { Interview, InterviewType } from '../../lib/types'
import { useAsync } from '../../lib/useAsync'
import { Badge, Button, Dialog, EmptyState, Field, Input, Select, Skeleton, Textarea } from '../ui/core'
import { useToast } from '../ui/toast'
import { formatDate } from '../../lib/utils'

const TYPES: Array<{ value: InterviewType; label: string }> = [
  { value: 'technical', label: 'Technical' },
  { value: 'system_design', label: 'System design' },
  { value: 'hr', label: 'HR / culture' },
  { value: 'panel', label: 'Panel' },
]

export function InterviewPanel({ applicationId, candidateName, jobTitle }: { applicationId: number; candidateName: string; jobTitle: string }) {
  const { push } = useToast()
  const list = useAsync(() => interviewApi.list(), [])
  const [open, setOpen] = useState(false)
  const [when, setWhen] = useState('')
  const [type, setType] = useState<InterviewType>('technical')
  const [duration, setDuration] = useState(60)
  const [location, setLocation] = useState('Google Meet')
  const [saving, setSaving] = useState(false)
  const [conflict, setConflict] = useState<string | null>(null)
  const [fbFor, setFbFor] = useState<number | null>(null)
  const [fb, setFb] = useState({ rating: 4, strengths: '', concerns: '', recommendation: 'yes' as 'strong_yes' | 'yes' | 'no' | 'strong_no' })
  const [fbSaving, setFbSaving] = useState(false)
  const [decideFor, setDecideFor] = useState<number | null>(null)
  const [decision, setDecision] = useState<'selected' | 'rejected'>('selected')
  const [rationale, setRationale] = useState('')
  const [decSaving, setDecSaving] = useState(false)

  const create = async () => {
    setConflict(null)
    if (!when) {
      setConflict('Pick a date and time.')
      return
    }
    setSaving(true)
    try {
      await interviewApi.create({
        application_id: applicationId,
        scheduled_at: new Date(when).toISOString(),
        interviewer_id: 1,
        interview_type: type,
        duration_min: duration,
        location,
      })
      push('Interview scheduled. The candidate timeline has been updated.', 'info')
      setOpen(false)
      setWhen('')
      list.reload()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not schedule the interview.'
      setConflict(message)
    } finally {
      setSaving(false)
    }
  }

  const saveFeedback = async () => {
    if (!fbFor) return
    if (!fb.strengths.trim()) {
      push('Add at least one strength before saving.', 'error')
      return
    }
    setFbSaving(true)
    try {
      await interviewApi.feedback(fbFor, fb)
      push('Interview feedback saved.')
      setFbFor(null)
      setFb({ rating: 4, strengths: '', concerns: '', recommendation: 'yes' })
    } catch (e) {
      push(e instanceof Error ? e.message : 'Could not save feedback.', 'error')
    } finally {
      setFbSaving(false)
    }
  }

  const saveDecision = async () => {
    if (!decideFor) return
    if (!rationale.trim()) {
      push('Add a rationale for the audit trail.', 'error')
      return
    }
    setDecSaving(true)
    try {
      await interviewApi.decision(decideFor, decision, rationale.trim())
      push(`Final decision recorded: ${decision}.`)
      setDecideFor(null)
      setRationale('')
    } catch (e) {
      push(e instanceof Error ? e.message : 'Could not record the decision.', 'error')
    } finally {
      setDecSaving(false)
    }
  }

  const mine = (list.data ?? []).filter((i: Interview) => i.application_id === applicationId)

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <p className="text-micro font-medium uppercase tracking-wider text-faint">Interviews</p>
        <Button size="sm" onClick={() => setOpen(true)}>
          <CalendarPlus className="h-3.5 w-3.5" /> Schedule
        </Button>
      </div>

      {list.error ? (
        <p className="px-4 py-3 text-xs text-bad">{list.error}</p>
      ) : list.loading ? (
        <div className="p-3"><Skeleton className="h-16" /></div>
      ) : mine.length === 0 ? (
        <EmptyState icon={<CalendarClock className="h-4 w-4" />} title="No interview scheduled" body="Book a slot; overlapping interviewer times are rejected with the conflicting booking." />
      ) : (
        <ul className="divide-y divide-line">
          {mine.map((i) => (
            <li key={i.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-ink">{formatDate(i.scheduled_at, true)}</p>
                <Badge tone="accent">{i.status}</Badge>
              </div>
              <p className="mt-0.5 text-micro text-faint">
                {i.duration_min} min · {i.interview_type.replace('_', ' ')} · {i.interviewer_name} · <MapPin className="inline h-3 w-3" /> {i.location}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Button size="sm" variant="ghost" onClick={() => setFbFor(i.id)}>
                  <Star className="h-3 w-3" /> Feedback
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setDecideFor(i.id); setDecision('selected'); setRationale('') }}>
                  <CheckSquare className="h-3 w-3" /> Decide
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={Boolean(fbFor)}
        onClose={() => setFbFor(null)}
        title="Interviewer feedback"
        description="Structured, stored against the interview."
        footer={
          <>
            <Button variant="ghost" onClick={() => setFbFor(null)}>Cancel</Button>
            <Button variant="primary" loading={fbSaving} onClick={saveFeedback}>Save feedback</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Rating" htmlFor="rating">
            <Select id="rating" value={fb.rating} onChange={(e) => setFb({ ...fb, rating: Number(e.target.value) })}>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} / 5</option>)}
            </Select>
          </Field>
          <Field label="Strengths" htmlFor="strengths">
            <Textarea id="strengths" rows={2} value={fb.strengths} onChange={(e) => setFb({ ...fb, strengths: e.target.value })} placeholder="Concrete evidence of Django scale…" />
          </Field>
          <Field label="Concerns" htmlFor="concerns">
            <Textarea id="concerns" rows={2} value={fb.concerns} onChange={(e) => setFb({ ...fb, concerns: e.target.value })} placeholder="Limited cloud operations depth…" />
          </Field>
          <Field label="Recommendation" htmlFor="rec">
            <Select id="rec" value={fb.recommendation} onChange={(e) => setFb({ ...fb, recommendation: e.target.value as typeof fb.recommendation })}>
              <option value="strong_yes">Strong yes</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
              <option value="strong_no">Strong no</option>
            </Select>
          </Field>
        </div>
      </Dialog>

      <Dialog
        open={Boolean(decideFor)}
        onClose={() => setDecideFor(null)}
        title="Record final decision"
        description="This is a human decision. It updates the application stage and the audit trail."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDecideFor(null)}>Cancel</Button>
            <Button variant={decision === 'rejected' ? 'danger' : 'primary'} loading={decSaving} onClick={saveDecision}>Record decision</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Decision" htmlFor="decision">
            <Select id="decision" value={decision} onChange={(e) => setDecision(e.target.value as 'selected' | 'rejected')}>
              <option value="selected">Select candidate</option>
              <option value="rejected">Reject candidate</option>
            </Select>
          </Field>
          <Field label="Rationale (required)" htmlFor="rationale">
            <Textarea id="rationale" rows={3} value={rationale} onChange={(e) => setRationale(e.target.value)} placeholder="Strong technical signal and clear ownership evidence…" />
          </Field>
        </div>
      </Dialog>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Schedule an interview"
        description={`${candidateName} · ${jobTitle}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={saving} onClick={create}>Schedule</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Date and time" htmlFor="when" hint="Local time is converted to UTC for storage.">
            <Input id="when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Interview type" htmlFor="type">
              <Select id="type" value={type} onChange={(e) => setType(e.target.value as InterviewType)}>
                {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
            </Field>
            <Field label="Duration (minutes)" htmlFor="duration">
              <Select id="duration" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                {[30, 45, 60, 90].map((d) => <option key={d} value={d}>{d}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Location or link" htmlFor="location">
            <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} />
          </Field>
          <p className="text-micro text-faint">Interviewer: Nadia Rahman (you). Conflicts with your existing bookings are blocked.</p>

          {conflict && (
            <div className="flex items-start gap-2 rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-xs text-bad" role="alert">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{conflict}</span>
            </div>
          )}
        </div>
      </Dialog>
    </div>
  )
}
