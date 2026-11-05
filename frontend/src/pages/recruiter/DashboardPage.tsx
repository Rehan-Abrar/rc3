import { Link } from 'react-router-dom'
import { BriefcaseBusiness } from 'lucide-react'
import { analyticsApi, applications, jobs } from '../../lib/api'
import { useAsync } from '../../lib/useAsync'
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, Skeleton, StatCard } from '../../components/ui/core'
import { PageHeader } from '../../components/layout/AppShell'
import { STAGE_LABEL, formatDate, formatSalary, stageTone } from '../../lib/utils'
import { ScoreNumber } from '../../components/ui/score'

export function RecruiterDashboardPage() {
  const stats = useAsync(() => analyticsApi.overview())
  const jobList = useAsync(() => jobs.list({ status: 'open' }))
  const primaryJobId = jobList.data?.[0]?.id
  const applicants = useAsync(() => (primaryJobId ? applications.forJob(primaryJobId) : Promise.resolve([])), [primaryJobId])

  const s = stats.data
  const top = (applicants.data ?? []).slice(0, 4)
  const funnel = buildFunnel(s)

  return (
    <div className="space-y-4">
      <PageHeader
        title="Overview"
        description="Live picture of your pipeline. Scores are evidence-weighted and always explainable."
        actions={
          <Link to="/recruiter/jobs/new">
            <Button size="sm" variant="primary">
              <BriefcaseBusiness className="h-3.5 w-3.5" /> Post a job
            </Button>
          </Link>
        }
      />

      {stats.error ? (
        <Card><ErrorState message={stats.error} onRetry={stats.reload} /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {stats.loading &&
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[86px]" />)}
          {s && (
            <>
              <StatCard index="01" label="Active jobs" value={s.active_jobs} hint="Open requisitions" />
              <StatCard index="02" label="Applications" value={s.applications} hint="Across all jobs" />
              <StatCard index="03" label="Shortlisted" value={s.shortlisted} tone="good" hint="Human-approved" />
              <StatCard index="04" label="Pending reviews" value={s.pending_reviews} tone="warn" hint="Awaiting a decision" />
              <StatCard index="05" label="Interviews" value={s.interviews} tone="accent" hint="Scheduled" />
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader
            title="Ranked applicants"
            subtitle={jobList.data?.[0] ? `Highest evidence for ${jobList.data[0].title}` : 'Highest evidence-weighted relevance first'}
            actions={
              <Link to="/recruiter/jobs/1/applicants" className="text-xs text-accent hover:underline">
                View all
              </Link>
            }
          />
          {applicants.error ? (
            <ErrorState message={applicants.error} onRetry={applicants.reload} />
          ) : applicants.loading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : top.length === 0 ? (
            <EmptyState title="No applicants yet" body="Applications appear here as soon as candidates apply." />
          ) : (
            <ul className="divide-y divide-line">
              {top.map((a, i) => (
                <li key={a.application_id}>
                  <Link
                    to={`/recruiter/applications/${a.application_id}`}
                    className="row-hover grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 overflow-hidden px-4 py-3 sm:grid-cols-[24px_minmax(0,0.9fr)_minmax(0,1fr)_64px]"
                  >
                    <span className="font-mono text-[9px] text-faint">{String(i + 1).padStart(2, '0')}</span>
                    <span className="min-w-0">
                      <span className="block truncate body-copy text-xs font-semibold text-ink">{a.candidate.name}</span>
                      <span className="mt-0.5 block truncate body-copy text-[11px] text-muted">
                        {jobList.data?.find((j) => j.id === a.job_id)?.title ?? a.matched.slice(0, 2).join(' · ') ?? 'Awaiting assessment'}
                      </span>
                    </span>
                    <span className="col-span-2 hidden min-w-0 flex-wrap items-center gap-1 sm:col-span-1 sm:flex">
                      {a.matched.slice(0, 2).map((m) => (
                        <span key={m} className="max-w-[130px] truncate border border-line bg-canvas px-1.5 py-0.5 font-ui text-[10px] text-muted">{m}</span>
                      ))}
                      <Badge tone={stageTone(a.stage)}>{STAGE_LABEL[a.stage]}</Badge>
                    </span>
                    <span className="col-start-3 row-start-1 text-right sm:col-start-4">
                      {a.score ? (
                        <ScoreNumber score={a.score} size="md" />
                      ) : (
                        <span className="text-sm text-faint">—</span>
                      )}
                    </span>
                    <span className="col-span-2 col-start-2 flex items-center gap-1 sm:hidden">
                      {a.matched.slice(0, 2).map((m) => (
                        <span key={m} className="max-w-[110px] truncate border border-line bg-canvas px-1.5 py-0.5 font-ui text-[10px] text-muted">{m}</span>
                      ))}
                      <Badge tone={stageTone(a.stage)}>{STAGE_LABEL[a.stage]}</Badge>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Open jobs"
              actions={
                <Link to="/recruiter/jobs" className="text-xs text-accent hover:underline">
                  Manage
                </Link>
              }
            />
            {jobList.error ? (
              <ErrorState message={jobList.error} onRetry={jobList.reload} />
            ) : jobList.loading ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
              </div>
            ) : (jobList.data ?? []).length === 0 ? (
              <EmptyState title="No open roles" body="Post a job to start collecting applications." />
            ) : (
              <ul className="divide-y divide-line">
                {(jobList.data ?? []).map((j) => (
                  <li key={j.id}>
                    <Link to={`/recruiter/jobs/${j.id}`} className="row-hover block px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">{j.title}</p>
                          <p className="break-words text-micro text-faint">
                            {j.department} · {j.location} · {formatSalary(j.salary_min, j.salary_max)}
                          </p>
                        </div>
                        <Badge tone="neutral">{j.applicant_count} applied</Badge>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[1.35fr_1fr]">
      <Card>
        <CardHeader
          title="Pipeline funnel"
          subtitle="Current position of every application, cumulative from the top"
          actions={
            s ? (
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint tnum">
                {s.applications} in pipeline
              </span>
            ) : null
          }
        />
        {stats.loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9" />)}
          </div>
        ) : s && s.applications === 0 ? (
          <EmptyState title="No applications yet" body="Funnel stages fill in as candidates apply and move through review." />
        ) : (
          <div className="px-4">
            <ul className="space-y-2 py-3">
              {funnel.rows.map((row, i) => (
                <li key={row.label}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="font-mono text-[9px] text-faint">0{i + 1}</span>
                      <span className="truncate body-copy text-xs text-ink">{row.label}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-muted tnum">
                      {row.count}<span className="text-faint"> · {row.pct}%</span>
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden bg-elevated" role="presentation">
                    <div className="h-full bg-accent" style={{ width: `${row.width}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            <p className="border-t border-line py-2.5 text-[10px] leading-relaxed text-faint">
              Cumulative — an application at interview is also counted as screened and shortlisted.
              {funnel.rejected > 0 && ` ${funnel.rejected} rejected, excluded from the funnel.`}
            </p>
          </div>
        )}
      </Card>

        <Card>
          <CardHeader title="Common skill gaps" subtitle="Across this job's applicants" />
          {stats.loading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8" />)}
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {(s?.common_gaps ?? []).map((g) => {
                const max = Math.max(1, ...(s?.common_gaps ?? []).map((x) => x.count))
                return (
                  <li key={g.skill} className="px-4 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate body-copy text-xs text-ink">{g.skill}</p>
                      <span className="shrink-0 font-mono text-[10px] text-muted tnum">{String(g.count).padStart(2, '0')}</span>
                    </div>
                    <div className="mt-1.5 h-1 w-full overflow-hidden bg-elevated">
                      <div className="h-full bg-accent/70" style={{ width: `${(g.count / max) * 100}%` }} />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}

function buildFunnel(s: { applications: number; by_stage: { stage: string; count: number }[] } | null) {
  const at = (stage: string) => s?.by_stage.find((x) => x.stage === stage)?.count ?? 0
  const screened =
    at('parsed') + at('assessed') + at('recruiter_review') + at('shortlisted') + at('interview') + at('selected')
  const shortlisted = at('shortlisted') + at('interview') + at('selected')
  const interviewed = at('interview') + at('selected')
  const selected = at('selected')
  const rows = [
    { label: 'Applications', count: s?.applications ?? 0 },
    { label: 'Screened / assessed', count: screened },
    { label: 'Shortlisted', count: shortlisted },
    { label: 'Interviewed', count: interviewed },
    { label: 'Selected', count: selected },
  ].map((row) => {
    const top = Math.max(s?.applications ?? 0, 1)
    return {
      ...row,
      pct: s?.applications ? Math.round((row.count / s.applications) * 100) : 0,
      width: Math.round((row.count / top) * 100),
    }
  })
  return { rows, rejected: at('rejected') }
}
