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

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader title="Scheduled" subtitle={`${rows.length} interview${rows.length === 1 ? '' : 's'}`} />
          {list.error ? (
            <ErrorState message={list.error} onRetry={list.reload} />
          ) : list.loading ? (
            <div className="space-y-2 p-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : rows.length === 0 ? (
            <EmptyState icon={<CalendarClock className="h-4 w-4" />} title="No interviews scheduled" body="Shortlist a candidate and book a slot." />
          ) : (
            <ul className="divide-y divide-line">
              {rows.map((i) => (
                <li key={i.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/recruiter/applications/${i.application_id}`} className="text-sm font-medium text-ink hover:text-accent">
                        {i.candidate_name ?? 'Candidate'}
                      </Link>
                      <Badge tone="accent">{i.status}</Badge>
                    </div>
                    <p className="mt-0.5 text-micro text-faint">
                      {i.job_title} · {i.interview_type.replace('_', ' ')} · {i.duration_min} min
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-micro text-muted">
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
          <div className="space-y-3 px-4 py-3 text-xs text-muted">
            <p>
              The scheduler compares the new window against every booked interview for the same interviewer.
              A clash returns a <span className="font-mono text-ink">409</span> and names the conflicting booking.
            </p>
            {rows[0] && (
              <div className="rounded-lg border border-line bg-canvas/50 p-2.5">
                <p className="text-micro text-faint">Existing booking</p>
                <p className="mt-0.5 text-ink">{formatDate(rows[0].scheduled_at, true)} · {rows[0].duration_min} min</p>
                <p className="text-micro text-faint">{rows[0].candidate_name} with {rows[0].interviewer_name}</p>
              </div>
            )}
            <p className="text-micro text-faint">
              Tip: open the schedule dialog, choose a time inside the existing booking window, and the error below will show the clash.
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
            <div className="flex items-start gap-2 rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-xs text-bad" role="alert">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </Dialog>
    </div>
  )
}
