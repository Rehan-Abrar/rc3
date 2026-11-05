import { Link } from 'react-router-dom'
import { ArrowRight, BriefcaseBusiness, CheckCircle2, Eye, FileText, Sparkles } from 'lucide-react'
import { applications, resumeApi, talentApi } from '../../lib/api'
import { useAsync } from '../../lib/useAsync'
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, Skeleton, StatCard } from '../../components/ui/core'
import { PageHeader } from '../../components/layout/AppShell'
import { STAGE_LABEL, formatRelative, formatSalary, stageTone } from '../../lib/utils'

export function CandidateDashboardPage() {
  const mine = useAsync(() => applications.mine(), [])
  const resumes = useAsync(() => resumeApi.listMine(), [])
  const recommended = useAsync(() => talentApi.recommended(), [])

  const apps = mine.data ?? []
  const active = apps.filter((a) => !['rejected', 'selected'].includes(a.stage))
  const interviews = apps.filter((a) => a.stage === 'interview')

  return (
    <div className="space-y-4">
      <PageHeader
        title="Your job search"
        description="Track applications, keep your resume sharp, and see roles matched to your verified skills."
        actions={
          <Link to="/candidate/jobs">
            <Button size="sm" variant="primary"><BriefcaseBusiness className="h-3.5 w-3.5" /> Browse jobs</Button>
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Applications" value={apps.length} hint="Total submitted" icon={<FileText className="h-4 w-4" />} />
        <StatCard label="In progress" value={active.length} tone="accent" hint="Not yet decided" icon={<Eye className="h-4 w-4" />} />
        <StatCard label="Interviews" value={interviews.length} tone="good" hint="Scheduled" icon={<CheckCircle2 className="h-4 w-4" />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader
            title="Your applications"
            actions={<Link to="/candidate/applications" className="text-xs text-accent hover:underline">View all</Link>}
          />
          {mine.error ? (
            <ErrorState message={mine.error} onRetry={mine.reload} />
          ) : mine.loading ? (
            <div className="space-y-2 p-3">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : apps.length === 0 ? (
            <EmptyState title="No applications yet" body="Browse open roles and apply with your uploaded resume." action={<Link to="/candidate/jobs"><Button size="sm">Browse jobs</Button></Link>} />
          ) : (
            <ul className="divide-y divide-line">
              {apps.slice(0, 4).map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink">{a.job.title}</p>
                    <p className="text-micro text-faint">{a.job.location} · applied {formatRelative(a.created_at)}</p>
                  </div>
                  <Badge tone={stageTone(a.stage)}>{STAGE_LABEL[a.stage]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Resume" subtitle="The source of your evidence" actions={<Link to="/candidate/resume" className="text-xs text-accent hover:underline">Manage</Link>} />
            <div className="px-4 py-3">
              {resumes.loading ? (
                <Skeleton className="h-12" />
              ) : (resumes.data ?? []).length === 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted">Upload a PDF resume so recruiters can see verified evidence.</p>
                  <Link to="/candidate/resume"><Button size="sm" variant="primary">Upload resume</Button></Link>
                </div>
              ) : (
                (resumes.data ?? []).slice(0, 2).map((r) => (
                  <div key={r.id} className="mb-2 rounded-lg border border-line bg-canvas/50 p-2.5 last:mb-0">
                    <p className="flex items-center gap-2 text-xs text-ink"><FileText className="h-3.5 w-3.5 text-faint" /> {r.filename}</p>
                    <p className="mt-0.5 text-micro text-faint">{r.page_count} page(s) · parse {r.parse_status}</p>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Recommended for you" subtitle="Based on verified resume skills" />
            {recommended.loading ? (
              <div className="space-y-2 p-3">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
            ) : (
              <ul className="divide-y divide-line">
                {(recommended.data ?? []).slice(0, 3).map((r) => (
                  <li key={r.job.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link to="/candidate/jobs" className="truncate text-sm text-ink hover:text-accent">{r.job.title}</Link>
                        <p className="text-micro text-faint">{r.job.location} · {formatSalary(r.job.salary_min, r.job.salary_max)}</p>
                        <p className="mt-1 flex items-center gap-1 text-micro text-muted"><Sparkles className="h-3 w-3 text-accent" /> {r.reason}</p>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-faint" />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
