import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, MapPin, Pencil, RotateCcw, Square, Users } from 'lucide-react'
import { applications, jobs as jobsApi } from '../../lib/api'
import { useAsync } from '../../lib/useAsync'
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, Skeleton, StatCard } from '../../components/ui/core'
import { PageHeader } from '../../components/layout/AppShell'
import { useToast } from '../../components/ui/toast'
import { STAGE_LABEL, formatDate, formatRelative, formatSalary, jobStatusTone, stageTone } from '../../lib/utils'
import { ScoreNumber, scoreBandLabel } from '../../components/ui/score'

export function JobDetailPage() {
  const { id } = useParams()
  const jobId = Number(id)
  const { push } = useToast()
  const job = useAsync(() => jobsApi.get(jobId), [jobId])
  const applicants = useAsync(() => applications.forJob(jobId), [jobId])
  const [busy, setBusy] = useState(false)

  const j = job.data

  const toggle = async () => {
    if (!j) return
    setBusy(true)
    try {
      await jobsApi.setStatus(j.id, j.status === 'open' ? 'closed' : 'open')
      push(j.status === 'open' ? 'Job closed.' : 'Job reopened.')
      job.reload()
    } catch (e) {
      push(e instanceof Error ? e.message : 'Could not update the job.', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (job.error) return <Card><ErrorState message={job.error} onRetry={job.reload} /></Card>
  if (job.loading || !j) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-56" />
      </div>
    )
  }

  const ranked = applicants.data ?? []

  return (
    <div>
      <PageHeader
        title={j.title}
        description={`${j.department ?? 'No department'} · ${j.location ?? 'Location TBC'}`}
        meta={
          <>
            <Badge tone={jobStatusTone(j.status)} dot>{j.status === 'open' ? 'Open' : 'Closed'}</Badge>
            <Badge tone="neutral">{j.employment_type}</Badge>
            <Badge tone="neutral">{formatSalary(j.salary_min, j.salary_max)}</Badge>
            <Badge tone="neutral">Updated {formatRelative(j.updated_at)}</Badge>
          </>
        }
        actions={
          <>
            <Link to="/recruiter/jobs">
              <Button size="sm" variant="ghost"><ArrowLeft className="h-3.5 w-3.5" /> Jobs</Button>
            </Link>
            <Link to={`/recruiter/jobs/${j.id}/edit`}>
              <Button size="sm"><Pencil className="h-3.5 w-3.5" /> Edit</Button>
            </Link>
            <Button size="sm" variant={j.status === 'open' ? 'danger' : 'secondary'} loading={busy} onClick={toggle}>
              {j.status === 'open' ? <Square className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}
              {j.status === 'open' ? 'Close job' : 'Reopen job'}
            </Button>
            <Link to={`/recruiter/jobs/${j.id}/applicants`}>
              <Button size="sm" variant="primary"><Users className="h-3.5 w-3.5" /> Applicants</Button>
            </Link>
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard index="01" label="Applicants" value={j.applicant_count} hint="Total applications" />
        <StatCard index="02" label="Shortlisted" value={j.shortlisted_count} tone="good" hint="Human-approved" />
        <StatCard index="03" label="Requirements" value={j.requirements.length} hint={`${j.requirements.filter((r) => r.importance === 'required').length} required`} />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[1.35fr_1fr]">
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader title="Job description" />
            <div className="whitespace-pre-line px-4 py-3 body-copy text-sm leading-relaxed text-muted">{j.description}</div>
          </Card>

          <Card>
            <CardHeader
              title="Ranked applicants"
              subtitle="Evidence-weighted relevance, highest first"
              actions={<Link to={`/recruiter/jobs/${j.id}/applicants`} className="text-xs text-accent hover:underline">Open full list</Link>}
            />
            {applicants.error ? (
              <ErrorState message={applicants.error} onRetry={applicants.reload} />
            ) : applicants.loading ? (
              <div className="space-y-2 p-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
            ) : ranked.length === 0 ? (
              <EmptyState title="No applicants yet" body="Share the role or wait for candidates to apply." />
            ) : (
              <ul className="divide-y divide-line">
                {ranked.slice(0, 5).map((a) => (
                  <li key={a.application_id}>
                    <Link to={`/recruiter/applications/${a.application_id}`} className="row-hover flex items-center gap-3 px-4 py-3">
                      <div className="shrink-0 text-right">
                        <ScoreNumber score={a.score} size="sm" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate body-copy text-sm font-medium text-ink">{a.candidate.name}</p>
                        <p className="truncate body-copy text-[11px] text-muted">{scoreBandLabel(a.score)} · {a.matched.length} skills matched</p>
                      </div>
                      <Badge tone={stageTone(a.stage)}>{STAGE_LABEL[a.stage]}</Badge>
                      <ArrowRight className="h-3.5 w-3.5 text-faint" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card className="min-w-0">
          <CardHeader title="Requirements" subtitle="Used as the matching contract" />
          <ul className="divide-y divide-line">
            {j.requirements.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="body-copy text-sm text-ink">{r.label}</p>
                  {r.evidence_hint && <p className="mt-0.5 body-copy text-[11px] leading-snug text-faint">{r.evidence_hint}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {r.min_years != null && <Badge tone="neutral">{r.min_years}+ yrs</Badge>}
                  <Badge tone={r.importance === 'required' ? 'accent' : 'neutral'}>{r.importance}</Badge>
                </div>
              </li>
            ))}
          </ul>
          <div className="border-t border-line px-4 py-3 font-mono text-[10px] uppercase tracking-[0.06em] text-faint">
            Created {formatDate(j.created_at)} · <MapPin className="inline h-3 w-3" /> {j.location ?? 'Remote'}
          </div>
        </Card>
      </div>
    </div>
  )
}
