import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowUpRight, BriefcaseBusiness, CalendarClock, CheckCircle2, ClipboardList, Timer, Users } from 'lucide-react'
import { analyticsApi, auditApi } from '../../lib/api'
import { useAsync } from '../../lib/useAsync'
import { Badge, Card, CardHeader, ErrorState, Skeleton, StatCard } from '../../components/ui/core'
import { PageHeader } from '../../components/layout/AppShell'
import { STAGE_LABEL } from '../../lib/utils'

const STAGE_COLORS: Record<string, string> = {
  submitted: '#6c7889',
  parsed: '#7d9cff',
  assessed: '#5b8cff',
  recruiter_review: '#f0b24a',
  shortlisted: '#3ddc97',
  interview: '#7d9cff',
  selected: '#3ddc97',
  rejected: '#f47280',
}

const tooltipStyle = {
  backgroundColor: '#181d26',
  border: '1px solid #272e3a',
  borderRadius: 8,
  fontSize: 12,
  color: '#e9eef6',
}

export function AnalyticsPage() {
  const stats = useAsync(() => analyticsApi.overview())
  const fairness = useAsync(() => auditApi.fairness(), [])
  const s = stats.data

  if (stats.error) return <Card><ErrorState message={stats.error} onRetry={stats.reload} /></Card>

  return (
    <div className="space-y-4">
      <PageHeader
        title="Analytics"
        description="Counts come straight from the application store — the same numbers the pipeline uses."
        actions={<Badge tone="neutral">Source of truth: applications + interviews</Badge>}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {stats.loading
          ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[86px]" />)
          : s && (
              <>
                <StatCard label="Active jobs" value={s.active_jobs} icon={<BriefcaseBusiness className="h-4 w-4" />} hint="Open requisitions" />
                <StatCard label="Applications" value={s.applications} icon={<Users className="h-4 w-4" />} hint="All time" />
                <StatCard label="Shortlisted" value={s.shortlisted} tone="good" icon={<CheckCircle2 className="h-4 w-4" />} hint={`${s.shortlist_rate}% of applications`} />
                <StatCard label="Pending reviews" value={s.pending_reviews} tone="warn" icon={<ClipboardList className="h-4 w-4" />} hint="Need a decision" />
                <StatCard label="Interviews" value={s.interviews} tone="accent" icon={<CalendarClock className="h-4 w-4" />} hint={`Avg process ${s.avg_processing_hours}h`} />
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
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-accent" aria-hidden /> Applications</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-good" aria-hidden /> Shortlisted</span>
              </div>
            }
          />
          <div className="h-[240px] px-2 py-3">
            {stats.loading ? (
              <Skeleton className="h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={s?.by_job ?? []} margin={{ top: 4, right: 12, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#272e3a" vertical={false} />
                  <XAxis dataKey="title" tick={{ fill: '#9ca7b7', fontSize: 10 }} axisLine={false} tickLine={false} interval={0} />
                  <YAxis tick={{ fill: '#6c7889', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Bar dataKey="applications" name="Applications" fill="#7d9cff" radius={[3, 3, 0, 0]} maxBarSize={42} />
                  <Bar dataKey="shortlisted" name="Shortlisted" fill="#3ddc97" radius={[3, 3, 0, 0]} maxBarSize={42} />
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
                  <CartesianGrid strokeDasharray="3 3" stroke="#272e3a" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#9ca7b7', fontSize: 10 }} axisLine={false} tickLine={false} interval={0} />
                  <YAxis tick={{ fill: '#6c7889', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Bar dataKey="count" name="Candidates" radius={[3, 3, 0, 0]} maxBarSize={42}>
                    {(s?.by_stage ?? []).map((x) => (
                      <Cell key={x.stage} fill={STAGE_COLORS[x.stage] ?? '#7d9cff'} />
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
              <ul className="mt-3 space-y-1.5">
                {[
                  'Name, gender, age, nationality and marital status are dropped before scoring.',
                  'The same resume is scored twice with those fields swapped.',
                  'Any delta above zero means the scoring path leaks a protected attribute.',
                ].map((line) => (
                  <li key={line} className="flex gap-2 text-micro leading-relaxed text-faint">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-faint/60" aria-hidden />
                    {line}
                  </li>
                ))}
              </ul>
              <div className="mt-auto grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-line bg-canvas/40 px-3 py-2 text-center">
                  <p className="text-micro text-faint">Baseline</p>
                  <p className="text-lg font-semibold text-ink tnum">{fairness.data.baseline}</p>
                </div>
                <div className="rounded-lg border border-line bg-canvas/40 px-3 py-2 text-center">
                  <p className="text-micro text-faint">Perturbed</p>
                  <p className="text-lg font-semibold text-ink tnum">{fairness.data.perturbed}</p>
                </div>
                <div className="rounded-lg border border-good/30 bg-good/10 px-3 py-2 text-center">
                  <p className="text-micro text-good">Delta</p>
                  <p className="text-lg font-semibold text-good tnum">{fairness.data.delta}</p>
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

      <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader title="Conversion" />
          <div className="space-y-3 px-4 py-3">
            {[
              { label: 'Application → shortlist', value: `${s?.shortlist_rate ?? 0}%`, icon: ArrowUpRight, hint: 'Human-approved only' },
              { label: 'Average processing time', value: `${s?.avg_processing_hours ?? 0}h`, icon: Timer, hint: 'Submission to first decision' },
              { label: 'Shortlisted vs. reviewed', value: s ? `${s.shortlisted}/${s.applications - s.pending_reviews}` : '—', icon: CheckCircle2, hint: 'Decided applications' },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-canvas/40 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <row.icon className="h-4 w-4 text-faint" />
                  <div>
                    <p className="text-xs text-ink">{row.label}</p>
                    <p className="text-micro text-faint">{row.hint}</p>
                  </div>
                </div>
                <p className="text-lg font-semibold text-ink tnum">{row.value}</p>
              </div>
            ))}
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
                      <span className="text-micro text-muted tnum">{g.count} applicants</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-elevated">
                      <div className="h-full rounded-full bg-warn/70" style={{ width: `${(g.count / max) * 100}%` }} />
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
