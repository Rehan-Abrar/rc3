import { useState } from 'react'
import { CalendarPlus, CalendarClock, MapPin, TriangleAlert } from 'lucide-react'
import { interviewApi } from '../../lib/api'
import type { Interview, InterviewType } from '../../lib/types'
import { useAsync } from '../../lib/useAsync'
import { Badge, Button, Dialog, EmptyState, Field, Input, Select, Skeleton } from '../ui/core'
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
            </li>
          ))}
        </ul>
      )}

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
