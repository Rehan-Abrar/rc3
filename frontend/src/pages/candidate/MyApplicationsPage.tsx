import { Link } from 'react-router-dom'
import { BriefcaseBusiness, CalendarClock, CheckCircle2, Clock } from 'lucide-react'
import { applications } from '../../lib/api'
import { useAsync } from '../../lib/useAsync'
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, Skeleton } from '../../components/ui/core'
import { PageHeader } from '../../components/layout/AppShell'
import { STAGE_LABEL, STAGE_ORDER, formatDate, formatRelative, stageTone } from '../../lib/utils'

const STEPS = ['submitted', 'parsed', 'assessed', 'recruiter_review', 'shortlisted', 'interview', 'selected'] as const

export function MyApplicationsPage() {
  const mine = useAsync(() => applications.mine(), [])
  const rows = mine.data ?? []

  return (
    <div>
      <PageHeader
        title="My applications"
        description="Statuses are set by a human recruiter. An application only moves forward through the stages you see here."
        actions={<Link to="/candidate/jobs"><Button size="sm">Find more roles</Button></Link>}
      />

      {mine.error ? (
        <Card><ErrorState message={mine.error} onRetry={mine.reload} /></Card>
      ) : mine.loading ? (
        <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-36" />)}</div>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BriefcaseBusiness className="h-4 w-4" />}
            title="No applications yet"
            body="Apply to a role and you will be able to follow every stage here."
            action={<Link to="/candidate/jobs"><Button size="sm" variant="primary">Browse jobs</Button></Link>}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((a) => {
            const currentIndex = STEPS.indexOf(a.stage as (typeof STEPS)[number])
            const rejected = a.stage === 'rejected'
            return (
              <Card key={a.id}>
                <CardHeader
                  title={
                    <span className="flex flex-wrap items-center gap-2">
                      {a.job.title}
                      <Badge tone={stageTone(a.stage)} dot>{STAGE_LABEL[a.stage]}</Badge>
                    </span>
                  }
                  subtitle={`${a.job.location} · applied ${formatRelative(a.created_at)}`}
                  actions={<Link to="/candidate/jobs" className="text-xs text-accent hover:underline">Similar roles</Link>}
                />
                <div className="px-4 py-4">
                  {rejected ? (
                    <div className="flex items-center gap-2 rounded-lg border border-bad/30 bg-bad/10 px-3 py-2.5 text-xs text-bad">
                      <Clock className="h-4 w-4" /> This application was closed by the recruiter. You can apply to other roles.
                    </div>
                  ) : (
                    <ol className="flex flex-wrap items-center gap-y-3">
                      {STEPS.map((s, i) => {
                        const done = i <= currentIndex
                        const isCurrent = i === currentIndex
                        return (
                          <li key={s} className="flex min-w-[92px] flex-1 items-start gap-2">
                            <span className="flex flex-col items-center">
                              <span
                                className={`flex h-5 w-5 items-center justify-center rounded-full border text-[10px] ${
                                  isCurrent
                                    ? 'border-accent bg-accent text-accent-ink'
                                    : done
                                      ? 'border-good/50 bg-good/15 text-good'
                                      : 'border-line bg-elevated text-faint'
                                }`}
                              >
                                {done && !isCurrent ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
                              </span>
                              {i !== STEPS.length - 1 && <span className={`mt-1 hidden h-px w-full sm:block ${done ? 'bg-good/40' : 'bg-line'}`} aria-hidden />}
                            </span>
                            <span className={`text-micro ${isCurrent ? 'text-ink' : done ? 'text-muted' : 'text-faint'}`}>
                              {STAGE_LABEL[s]}
                              {isCurrent && <span className="mt-0.5 block text-[10px] text-faint">current</span>}
                            </span>
                          </li>
                        )
                      })}
                    </ol>
                  )}

                  {(a.events?.length ?? 0) > 0 && (
                    <div className="mt-4 border-t border-line pt-3">
                      <p className="text-micro font-medium uppercase tracking-wider text-faint">History</p>
                      <ul className="mt-1.5 space-y-1">
                        {(a.events ?? []).slice(0, 3).map((e) => (
                          <li key={e.id} className="flex flex-wrap items-center gap-2 text-micro text-muted">
                            <CalendarClock className="h-3 w-3 text-faint" />
                            <span className="text-ink">{STAGE_LABEL[e.to_stage]}</span>
                            <span className="text-faint">· {formatDate(e.created_at, true)}</span>
                            {e.reason && <span className="text-faint">· {e.reason}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p className="mt-3 text-micro text-faint">Stages: {STAGE_ORDER.filter((s) => s !== 'rejected').map((s) => STAGE_LABEL[s]).join(' → ')}</p>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
