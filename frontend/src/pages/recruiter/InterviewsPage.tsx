import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, Link2, MapPin, TriangleAlert, UserRound } from 'lucide-react'
import { applications, interviewApi, jobs as jobsApi } from '../../lib/api'
import type { InterviewType } from '../../lib/types'
import { useAsync } from '../../lib/useAsync'
import { Badge, Button, Card, CardHeader, Dialog, EmptyState, ErrorState, Field, Input, Select, Skeleton, Tabs } from '../../components/ui/core'
import { PageHeader } from '../../components/layout/AppShell'
import { useToast } from '../../components/ui/toast'
import { formatDate } from '../../lib/utils'

export function InterviewsPage() {
  const { push } = useToast()
  const list = useAsync(() => interviewApi.list(), [])
  const open = useAsync(() => jobsApi.list({ status: 'open' }), [])
  const firstJob = open.data?.[0]?.id ?? 1
  const applicants = useAsync(() => applications.forJob(firstJob), [firstJob])

  const [dialog, setDialog] = useState(false)
  const [appId, setAppId] = useState<number | ''>('')
  const [when, setWhen] = useState('')
  const [type, setType] = useState<InterviewType>('technical')
  const [duration, setDuration] = useState(60)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const schedule = async () => {
    setError(null)
    if (!appId) return setError('Pick an application.')
    if (!when) return setError('Pick a date and time.')
    setSaving(true)
    try {
      await interviewApi.create({
        application_id: Number(appId),
        scheduled_at: new Date(when).toISOString(),
        interview_type: type,
        duration_min: duration,
        location: 'Google Meet',
      })
      push('Interview scheduled.')
      setDialog(false)
      setWhen('')
      list.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not schedule.')
    } finally {
      setSaving(false)
    }
  }

  const rows = list.data ?? []

  return (
    <div>
      <PageHeader
        title="Interviews"
        description="Every booking is stored against the application. Overlapping interviewer slots are rejected with the conflicting booking."
        actions={<Button size="sm" variant="primary" onClick={() => setDialog(true)}><CalendarClock className="h-3.5 w-3.5" /> Schedule interview</Button>}
      />

      <div className="grid items-start gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader
            title="Scheduled"
            subtitle="Booked slots across every open application"
          />
          {list.error ? (
            <ErrorState message={list.error} onRetry={list.reload} />
          ) : list.loading ? (
            <div className="space-y-2 p-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : rows.length === 0 ? (
            <div>
              <div className="flex flex-col items-center gap-2 border border-dashed border-line bg-canvas px-6 py-14 text-center">
                <CalendarClock className="h-5 w-5 text-faint" aria-hidden />
                <p className="font-display text-sm font-medium text-ink">No interviews scheduled</p>
                <p className="max-w-xs body-copy text-xs leading-relaxed text-muted">
                  Shortlist a candidate first, then book a slot. The booking moves them to the interview stage.
                </p>
                <Button size="sm" variant="primary" className="mt-1.5" onClick={() => setDialog(true)}>
                  Schedule interview
                </Button>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {rows.map((i) => (
                <li key={i.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/recruiter/applications/${i.application_id}`} className="body-copy text-sm font-semibold text-ink hover:text-accent">
                        {i.candidate_name ?? 'Candidate'}
                      </Link>
                      <Badge tone="accent">{i.status}</Badge>
                    </div>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.06em] text-faint">
                      {i.job_title} · {i.interview_type.replace('_', ' ')} · {i.duration_min} min
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 body-copy text-[11px] text-muted">
                      <span className="flex items-center gap-1"><CalendarClock className="h-3 w-3" /> {formatDate(i.scheduled_at, true)}</span>
                      <span className="flex items-center gap-1"><UserRound className="h-3 w-3" /> {i.interviewer_name}</span>
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {i.location}</span>
                    </p>
                  </div>
                  {i.conflict_flag && <Badge tone="bad">Conflict flagged</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Conflict detection" subtitle="Try booking a slot that overlaps an existing interview" />
          <div className="space-y-3 px-4 py-3 body-copy text-xs leading-relaxed text-muted">
            <p>
              The scheduler compares the new window against every booked interview for the same interviewer.
              A clash returns <span className="border border-bad/30 bg-bad/5 px-1 font-mono text-[10px] text-bad">409 CONFLICT</span>{' '}
              and names the booking that collides.
            </p>
            {rows[0] && (
              <div className="border border-line bg-canvas p-2.5">
                <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-faint">[ Existing booking ]</p>
                <p className="mt-1 body-copy text-ink">{formatDate(rows[0].scheduled_at, true)} · {rows[0].duration_min} min</p>
                <p className="body-copy text-[11px] text-faint">{rows[0].candidate_name} with {rows[0].interviewer_name}</p>
              </div>
            )}
            <p className="body-copy text-[11px] leading-relaxed text-faint">
              Tip: open the schedule dialog, pick a time inside this window, and the dialog will show the clash without losing your input.
            </p>
          </div>
        </Card>
      </div>

      <Dialog
        open={dialog}
        onClose={() => setDialog(false)}
        title="Schedule an interview"
        description="The candidate is moved to the interview stage automatically."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(false)}>Cancel</Button>
            <Button variant="primary" loading={saving} onClick={schedule}>Schedule</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Application" htmlFor="app">
            <Select id="app" value={appId} onChange={(e) => setAppId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Select a candidate…</option>
              {(applicants.data ?? []).map((a) => (
                <option key={a.application_id} value={a.application_id}>
                  {a.candidate.name} — {a.score ? `${Math.round(a.score.overall)}/100` : 'not assessed'}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date and time" htmlFor="when2">
            <Input id="when2" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Type" htmlFor="type2">
              <Select id="type2" value={type} onChange={(e) => setType(e.target.value as InterviewType)}>
                <option value="technical">Technical</option>
                <option value="system_design">System design</option>
                <option value="hr">HR / culture</option>
                <option value="panel">Panel</option>
              </Select>
            </Field>
            <Field label="Duration" htmlFor="dur2">
              <Select id="dur2" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                {[30, 45, 60, 90].map((d) => <option key={d} value={d}>{d} min</option>)}
              </Select>
            </Field>
          </div>
          {error && (
            <div className="flex items-start gap-2 border border-bad/30 bg-bad/5 px-3 py-2 text-xs text-bad" role="alert">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </Dialog>
    </div>
  )
}
