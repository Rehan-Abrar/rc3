import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowUpRight, BriefcaseBusiness, CalendarClock, CheckCircle2, ClipboardList, Timer, Users } from 'lucide-react'
import { analyticsApi, applications, auditApi } from '../../lib/api'
import { useAsync } from '../../lib/useAsync'
import { Badge, Card, CardHeader, ErrorState, Skeleton, StatCard } from '../../components/ui/core'
import { PageHeader } from '../../components/layout/AppShell'
import { STAGE_LABEL } from '../../lib/utils'

const STAGE_COLORS: Record<string, string> = {
  submitted: '#9CA3AF',
  parsed: '#668FD8',
  assessed: '#0043CA',
  recruiter_review: '#B45309',
  shortlisted: '#047857',
  interview: '#336AD6',
  selected: '#047857',
  rejected: '#DC2626',
}

const AXIS = { fill: '#6B7280', fontSize: 10 }
const tooltipStyle = {
  backgroundColor: '#FFFFFF',
  border: '1px solid #E5E7EB',
  borderRadius: 0,
  fontSize: 12,
  fontFamily: 'Instrument Sans, sans-serif',
  color: '#000F2E',
  boxShadow: '0 20px 40px -24px rgb(0 15 46 / 0.25)',
}

export function AnalyticsPage() {
  const stats = useAsync(() => analyticsApi.overview())
  const fairness = useAsync(() => auditApi.fairness(), [])
  const s = stats.data

  // Scores are read from the same applicant rows the ranked lists use — no derived or invented data.
  const jobIds = (s?.by_job ?? []).map((j) => j.job_id)
  const scoreRows = useAsync(
    () => Promise.all(jobIds.map((id) => applications.forJob(id))).then((rows) => rows.flat()),
    [jobIds.join(',')],
  )
  const distribution = buildDistribution((scoreRows.data ?? []).map((r) => r.score?.overall).filter((n): n is number => typeof n === 'number'))

  if (stats.error) return <Card><ErrorState message={stats.error} onRetry={stats.reload} /></Card>

  return (
    <div className="space-y-4">
      <PageHeader
        title="Analytics"
        description="Counts come straight from the application store — the same numbers the pipeline uses. "
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {stats.loading
          ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[86px]" />)
          : s && (
              <>
                <StatCard index="01" label="Active jobs" value={s.active_jobs} icon={<BriefcaseBusiness className="h-4 w-4" />} hint="Open requisitions" />
                <StatCard index="02" label="Applications" value={s.applications} icon={<Users className="h-4 w-4" />} hint="All time" />
                <StatCard index="03" label="Shortlisted" value={s.shortlisted} tone="good" icon={<CheckCircle2 className="h-4 w-4" />} hint={`${s.shortlist_rate}% of applications`} />
                <StatCard index="04" label="Pending reviews" value={s.pending_reviews} tone="warn" icon={<ClipboardList className="h-4 w-4" />} hint="Need a decision" />
                <StatCard index="05" label="Interviews" value={s.interviews} tone="accent" icon={<CalendarClock className="h-4 w-4" />} hint={`Avg process ${s.avg_processing_hours}h`} />
              </>
            )}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Applications by job"
            subtitle="Volume per open requisition"
            actions={
              <div className="flex items-center gap-3 text-micro text-muted">
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 bg-accent" aria-hidden /> Applications</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 bg-good" aria-hidden /> Shortlisted</span>
              </div>
            }
          />
          <div className="h-[240px] px-2 py-3">
            {stats.loading ? (
              <Skeleton className="h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={s?.by_job ?? []} margin={{ top: 4, right: 12, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#E5E7EB" vertical={false} />
                  <XAxis dataKey="title" tick={AXIS} axisLine={false} tickLine={false} interval={0} />
                  <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(0,15,46,0.04)' }} />
                  <Bar dataKey="applications" name="Applications" fill="#0043CA" maxBarSize={42} />
                  <Bar dataKey="shortlisted" name="Shortlisted" fill="#047857" maxBarSize={42} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Pipeline by stage" subtitle="Where candidates currently sit" />
          <div className="h-[240px] px-2 py-3">
            {stats.loading ? (
              <Skeleton className="h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={(s?.by_stage ?? []).map((x) => ({ ...x, label: STAGE_LABEL[x.stage] ?? x.stage }))} margin={{ top: 4, right: 12, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#E5E7EB" vertical={false} />
                  <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} interval={0} />
                  <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(0,15,46,0.04)' }} />
                  <Bar dataKey="count" name="Candidates" maxBarSize={42}>
                    {(s?.by_stage ?? []).map((x) => (
                      <Cell key={x.stage} fill={STAGE_COLORS[x.stage] ?? '#0043CA'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Fairness audit"
          subtitle="Protected attributes are stripped before scoring; swapping them must leave the score identical"
          actions={
            fairness.data ? (
              fairness.data.passed
                ? <Badge tone="good" dot>Audit passed · delta {fairness.data.delta}</Badge>
                : <Badge tone="bad" dot>Audit failed</Badge>
            ) : fairness.loading ? <Skeleton className="h-6 w-28" /> : null
          }
        />
        {fairness.error ? (
          <p className="px-4 py-3 text-xs text-bad">{fairness.error}</p>
        ) : fairness.loading ? (
          <div className="space-y-2 p-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
        ) : fairness.data ? (
          <div className="grid gap-4 p-4 lg:grid-cols-[1fr_1.2fr]">
            <div className="flex flex-col">
              <p className="text-xs leading-relaxed text-muted">{fairness.data.note}</p>
              <p className="mt-2 body-copy text-[11px] leading-relaxed text-faint">
                Identity fields are dropped, then the same resume is scored again with them swapped. Any delta above zero means
                the scoring path leaks a protected attribute.
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="border border-line bg-canvas px-3 py-2 text-center">
                  <p className="text-micro text-faint">Baseline</p>
                  <p className="font-display text-lg font-light text-ink tnum">{fairness.data.baseline}</p>
                </div>
                <div className="border border-line bg-canvas px-3 py-2 text-center">
                  <p className="text-micro text-faint">Perturbed</p>
                  <p className="font-display text-lg font-light text-ink tnum">{fairness.data.perturbed}</p>
                </div>
                <div className="border border-good/25 bg-good/8 px-3 py-2 text-center">
                  <p className="text-micro text-good">Delta</p>
                  <p className="font-display text-lg font-light text-good tnum">{fairness.data.delta}</p>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-xs">
                <thead>
                  <tr className="border-b border-line text-micro uppercase tracking-wider text-faint">
                    <th className="px-2 py-1.5 font-medium">Attribute</th>
                    <th className="px-2 py-1.5 text-right font-medium">Baseline</th>
                    <th className="px-2 py-1.5 text-right font-medium">Swapped</th>
                    <th className="px-2 py-1.5 text-right font-medium">Identical</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {fairness.data.checks.map((c) => (
                    <tr key={c.attribute}>
                      <td className="px-2 py-2 capitalize text-ink">{c.attribute}</td>
                      <td className="px-2 py-2 text-right text-muted tnum">{c.baseline}</td>
                      <td className="px-2 py-2 text-right text-muted tnum">{c.perturbed}</td>
                      <td className="px-2 py-2 text-right">{c.identical ? <Badge tone="good">unchanged</Badge> : <Badge tone="bad">changed</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </Card>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Score distribution"
            subtitle="AI assessment scores for every assessed applicant in your requisitions"
            actions={
              distribution.count > 0 ? (
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint tnum">
                  {distribution.count} assessed · median {distribution.median}
                </span>
              ) : null
            }
          />
          <div className="h-[220px] px-2 py-3">
            {stats.loading || scoreRows.loading ? (
              <Skeleton className="h-full" />
            ) : distribution.count === 0 ? (
              <div className="flex h-full items-center justify-center px-4 text-center">
                <p className="body-copy text-xs text-faint">
                  No assessed applications yet. Scores appear here as candidates are assessed against a job.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distribution.buckets} margin={{ top: 4, right: 12, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#E5E7EB" vertical={false} />
                  <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} interval={0} />
                  <YAxis tick={AXIS} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    cursor={{ fill: 'rgba(0,15,46,0.04)' }}
                    formatter={(value: number) => [`${value} applicant${value === 1 ? '' : 's'}`, 'Count']}
                    labelFormatter={(label: string) => `Score ${label}`}
                  />
                  <Bar dataKey="count" name="Applicants" fill="#0043CA" maxBarSize={54} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Common skill gaps" subtitle="What applicants are missing for this role" />
          {stats.loading ? (
            <div className="space-y-2 p-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9" />)}</div>
          ) : (
            <ul className="divide-y divide-line">
              {(s?.common_gaps ?? []).map((g) => {
                const max = Math.max(...(s?.common_gaps ?? []).map((x) => x.count), 1)
                return (
                  <li key={g.skill} className="px-4 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-ink">{g.skill}</p>
                      <span className="font-mono text-[10px] text-muted tnum">{g.count} {g.count === 1 ? 'applicant' : 'applicants'}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden bg-elevated">
                      <div className="h-full bg-warn/70" style={{ width: `${(g.count / max) * 100}%` }} />
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

function buildDistribution(scores: number[]) {
  const buckets = [
    { label: '0–19', min: 0, max: 19.999 },
    { label: '20–39', min: 20, max: 39.999 },
    { label: '40–59', min: 40, max: 59.999 },
    { label: '60–79', min: 60, max: 79.999 },
    { label: '80–100', min: 80, max: 100 },
  ].map((b) => ({ ...b, label: b.label, count: 0 }))
  for (const score of scores) {
    const bucket = buckets.find((b) => score >= b.min && score <= b.max)
    if (bucket) bucket.count += 1
  }
  const sorted = [...scores].sort((a, b) => a - b)
  let median = '—'
  if (sorted.length === 1) median = String(sorted[0])
  else if (sorted.length > 1) {
    const mid = Math.floor(sorted.length / 2)
    median = String(Math.round((sorted[mid - 1] + sorted[mid]) / 2))
  }
  return { buckets: buckets.map(({ label, count }) => ({ label, count })), count: scores.length, median }
}
