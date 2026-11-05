import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BriefcaseBusiness, Pencil, Plus, RotateCcw, Search, Square } from 'lucide-react'
import { jobs as jobsApi } from '../../lib/api'
import { useAsync } from '../../lib/useAsync'
import type { JobStatus } from '../../lib/types'
import { Badge, Button, Card, CardHeader, Dialog, EmptyState, ErrorState, Input, Select, Skeleton, Tabs } from '../../components/ui/core'
import { PageHeader } from '../../components/layout/AppShell'
import { useToast } from '../../components/ui/toast'
import { employmentLabel, formatDate, formatSalary, jobStatusTone } from '../../lib/utils'

export function JobsPage() {
  const [status, setStatus] = useState<'all' | JobStatus>('all')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState<number | null>(null)
  const [confirm, setConfirm] = useState<{ id: number; title: string; next: JobStatus } | null>(null)
  const { push } = useToast()
  const list = useAsync(() => jobsApi.list({ status: status === 'all' ? undefined : status, q }), [status, q])

  const toggle = async () => {
    if (!confirm) return
    setBusy(confirm.id)
    try {
      await jobsApi.setStatus(confirm.id, confirm.next)
      push(confirm.next === 'closed' ? 'Job closed. Candidates can no longer apply.' : 'Job reopened.')
      setConfirm(null)
      list.reload()
    } catch (e) {
      push(e instanceof Error ? e.message : 'Could not update the job.', 'error')
    } finally {
      setBusy(null)
    }
  }

  const rows = list.data ?? []

  return (
    <div>
      <PageHeader
        title="Jobs"
        description="Create, edit, close and reopen requisitions. Applicant counts update from real applications."
        actions={
          <Link to="/recruiter/jobs/new">
            <Button variant="primary" size="sm">
              <Plus className="h-4 w-4" /> New job
            </Button>
          </Link>
        }
      />

      <Card>
        <CardHeader
          title="Requisitions"
          subtitle={`${rows.length} ${rows.length === 1 ? 'job' : 'jobs'} shown`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" aria-hidden />
                <Input
                  aria-label="Search jobs"
                  placeholder="Search title, team, location"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="h-8 w-56 pl-8 text-xs"
                />
              </div>
              <Select
                aria-label="Filter by status"
                value={status}
                onChange={(e) => setStatus(e.target.value as 'all' | JobStatus)}
                className="h-8 w-28 text-xs"
              >
                <option value="all">All</option>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
              </Select>
            </div>
          }
        />

        {list.error ? (
          <ErrorState message={list.error} onRetry={list.reload} />
        ) : list.loading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<BriefcaseBusiness className="h-4 w-4" />}
            title="No jobs match"
            body="Try a different filter, or create your first requisition."
            action={
              <Link to="/recruiter/jobs/new">
                <Button size="sm" variant="primary">Post a job</Button>
              </Link>
            }
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line font-mono text-[10px] uppercase tracking-[0.08em] text-faint">
                    <th className="px-4 py-2.5 font-medium">Role</th>
                    <th className="px-4 py-2 font-medium">Location</th>
                    <th className="px-4 py-2 font-medium">Compensation</th>
                    <th className="px-4 py-2 text-right font-medium">Applicants</th>
                    <th className="px-4 py-2 text-right font-medium">Shortlisted</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">Updated</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((j) => (
                    <tr key={j.id} className="row-hover">
                      <td className="px-4 py-3">
                        <Link to={`/recruiter/jobs/${j.id}`} className="body-copy text-sm font-semibold text-ink hover:text-accent">
                          {j.title}
                        </Link>
                        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.06em] text-faint">
                          {j.department} · {employmentLabel(j.employment_type)}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted">{j.location}</td>
                      <td className="px-4 py-2.5 text-xs text-muted tnum">{formatSalary(j.salary_min, j.salary_max)}</td>
                      <td className="px-4 py-2.5 text-right text-xs text-ink tnum">{j.applicant_count}</td>
                      <td className="px-4 py-2.5 text-right text-xs text-muted tnum">{j.shortlisted_count}</td>
                      <td className="px-4 py-2.5">
                        <Badge tone={jobStatusTone(j.status)} dot>
                          {j.status === 'open' ? 'Open' : 'Closed'}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-faint">{formatDate(j.updated_at)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex justify-end gap-1">
                          <Link to={`/recruiter/jobs/${j.id}/edit`} aria-label={`Edit ${j.title}`}>
                            <Button size="sm" variant="ghost"><Pencil className="h-3.5 w-3.5" /></Button>
                          </Link>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={j.status === 'open' ? `Close ${j.title}` : `Reopen ${j.title}`}
                            onClick={() => setConfirm({ id: j.id, title: j.title, next: j.status === 'open' ? 'closed' : 'open' })}
                          >
                            {j.status === 'open' ? <Square className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-line md:hidden">
              {rows.map((j) => (
                <li key={j.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link to={`/recruiter/jobs/${j.id}`} className="text-sm font-medium text-ink">
                      {j.title}
                    </Link>
                    <Badge tone={jobStatusTone(j.status)} dot>{j.status}</Badge>
                  </div>
                  <p className="mt-0.5 text-micro text-faint">{j.location} · {formatSalary(j.salary_min, j.salary_max)}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-micro text-muted">
                    <span>{j.applicant_count} {j.applicant_count === 1 ? 'applicant' : 'applicants'}</span>
                    <span aria-hidden>·</span>
                    <span>{j.shortlisted_count} shortlisted</span>
                    <span aria-hidden>·</span>
                    <span>updated {formatDate(j.updated_at)}</span>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Link to={`/recruiter/jobs/${j.id}/edit`}>
                      <Button size="sm">Edit</Button>
                    </Link>
                    <Button size="sm" variant="ghost" onClick={() => setConfirm({ id: j.id, title: j.title, next: j.status === 'open' ? 'closed' : 'open' })}>
                      {j.status === 'open' ? 'Close' : 'Reopen'}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <Dialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={confirm?.next === 'closed' ? 'Close this job?' : 'Reopen this job?'}
        description={
          confirm?.next === 'closed'
            ? 'Closing hides the role from candidates. Existing applications stay readable.'
            : 'Reopening makes the role visible to candidates again.'
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button variant={confirm?.next === 'closed' ? 'danger' : 'primary'} loading={busy === confirm?.id} onClick={toggle}>
              {confirm?.next === 'closed' ? 'Close job' : 'Reopen job'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">{confirm?.title}</p>
      </Dialog>
    </div>
  )
}
