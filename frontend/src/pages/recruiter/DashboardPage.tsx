import { Link } from 'react-router-dom'
import { ArrowRight, BriefcaseBusiness, CalendarClock, CheckCircle2, ClipboardList, TrendingUp, Users } from 'lucide-react'
import { analyticsApi, applications, jobs } from '../../lib/api'
import { useAsync } from '../../lib/useAsync'
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, Skeleton, StatCard } from '../../components/ui/core'
import { PageHeader } from '../../components/layout/AppShell'
import { STAGE_LABEL, formatDate, formatRelative, formatSalary, stageTone } from '../../lib/utils'

export function RecruiterDashboardPage() {
  const stats = useAsync(() => analyticsApi.overview())
  const jobList = useAsync(() => jobs.list({ status: 'open' }))
  const applicants = useAsync(() => applications.forJob(1))

  const s = stats.data
  const top = (applicants.data ?? []).slice(0, 4)

  return (
    <div className="space-y-4">
      <PageHeader
        title="Overview"
        description="Live picture of your pipeline. Scores are evidence-weighted and always explainable."
        actions={
          <>
            <Link to="/recruiter/analytics">
              <Button size="sm" variant="ghost">
                <TrendingUp className="h-3.5 w-3.5" /> Analytics
              </Button>
            </Link>
            <Link to="/recruiter/jobs/new">
              <Button size="sm" variant="primary">
                <BriefcaseBusiness className="h-3.5 w-3.5" /> Post a job
              </Button>
            </Link>
          </>
        }
      />

      {stats.error ? (
        <Card><ErrorState message={stats.error} onRetry={stats.reload} /></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {stats.loading &&
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[86px]" />)}
          {s && (
            <>
              <StatCard label="Active jobs" value={s.active_jobs} hint="Open requisitions" icon={<BriefcaseBusiness className="h-4 w-4" />} />
              <StatCard label="Applications" value={s.applications} hint="Across all jobs" icon={<Users className="h-4 w-4" />} />
              <StatCard label="Shortlisted" value={s.shortlisted} tone="good" hint="Human-approved" icon={<CheckCircle2 className="h-4 w-4" />} />
              <StatCard label="Pending reviews" value={s.pending_reviews} tone="warn" hint="Awaiting a decision" icon={<ClipboardList className="h-4 w-4" />} />
              <StatCard label="Interviews" value={s.interviews} tone="accent" hint="Scheduled" icon={<CalendarClock className="h-4 w-4" />} />
            </>
          )}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader
            title="Ranked applicants"
            subtitle="Highest evidence-weighted relevance first"
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
              {top.map((a) => (
                <li key={a.application_id}>
                  <Link
                    to={`/recruiter/applications/${a.application_id}`}
                    className="row-hover flex items-center gap-3 px-4 py-2.5"
                  >
                    <span className="w-5 text-xs text-faint tnum">{a.score ? Math.round(a.score.overall) : '—'}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">{a.candidate.name}</span>
                      <span className="block truncate text-micro text-faint">{a.matched.slice(0, 3).join(' · ') || 'No evidence yet'}</span>
                    </span>
                    <Badge tone={stageTone(a.stage)}>{STAGE_LABEL[a.stage]}</Badge>
                    <ArrowRight className="h-3.5 w-3.5 text-faint" aria-hidden />
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
                          <p className="truncate text-micro text-faint">
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

          <Card>
            <CardHeader title="Common skill gaps" subtitle="Across this job's applicants" />
            {stats.loading ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8" />)}
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {(s?.common_gaps ?? []).map((g) => (
                  <li key={g.skill} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="text-xs text-ink">{g.skill}</p>
                    </div>
                    <span className="text-micro text-muted tnum">{g.count} applicants</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader title="Recent activity" subtitle="Every stage change is recorded with an actor and a reason." />
        <ul className="divide-y divide-line">
          {(s?.by_job ?? []).map((j) => (
            <li key={j.job_id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
              <span className="text-xs text-ink">{j.title}</span>
              <span className="text-micro text-muted tnum">
                {j.applications} applications · {j.shortlisted} shortlisted · updated {formatDate(new Date().toISOString())}
              </span>
            </li>
          ))}
          {(s?.by_job ?? []).length === 0 && <li className="px-4 py-3 text-xs text-faint">No activity yet.</li>}
        </ul>
      </Card>
    </div>
  )
}
