import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Columns3 } from 'lucide-react'
import { talentApi } from '../../lib/api'
import { useAsync } from '../../lib/useAsync'
import { ScoreNumber } from '../../components/ui/score'
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton } from '../../components/ui/core'
import { PageHeader } from '../../components/layout/AppShell'
import { ScoreBreakdown, SkillStatusPill } from '../../components/ui/score'
import { scoreBand } from '../../lib/utils'

export function ComparePage() {
  const [params] = useSearchParams()
  const jobId = Number(params.get('job') ?? 1)
  const ids = (params.get('ids') ?? '').split(',').filter(Boolean).map(Number).filter((n) => !Number.isNaN(n))
  const data = useAsync(() => (ids.length ? talentApi.compare(ids, jobId) : Promise.resolve(null)), [jobId, params.get('ids')])

  if (ids.length < 2) {
    return (
      <Card>
        <EmptyState
          icon={<Columns3 className="h-4 w-4" />}
          title="Pick two or three candidates"
          body="Select applicants from the ranked list or talent search to compare their evidence side by side."
          action={
            <Link to={`/recruiter/jobs/${jobId}/applicants`}>
              <Button size="sm">Open applicants</Button>
            </Link>
          }
        />
      </Card>
    )
  }

  if (data.error) return <Card><ErrorState message={data.error} onRetry={data.reload} /></Card>
  if (data.loading || !data.data) return <div className="space-y-3"><Skeleton className="h-40" /><Skeleton className="h-64" /></div>

  const { job, rows } = data.data
  const requirementLabels = Array.from(
    new Set(rows.flatMap((r) => [...r.matched, ...r.missing]).map((s) => s.label)),
  )

  return (
    <div>
      <Link to={`/recruiter/jobs/${jobId}/applicants`} className="mb-2 inline-flex items-center gap-1 text-xs text-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to applicants
      </Link>
      <PageHeader
        title="Compare candidates"
        description={`${job.title} · aligned requirement evidence, gaps and score explanations`}
        meta={<Badge tone="neutral">{rows.length} candidates</Badge>}
      />

      <div className="overflow-x-auto">
        <div className="grid min-w-[720px] gap-3" style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))` }}>
          {rows.map((row) => {
            const all = [...row.matched, ...row.missing]
            return (
              <Card key={row.candidate_id} className="flex flex-col">
                <div className="border-b border-line px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate body-copy text-sm font-semibold text-ink">{row.name}</p>
                    <div className="text-right">
                      <ScoreNumber score={row.score} size="md" />
                      <p className="mt-0.5 font-ui text-[10px] uppercase tracking-[0.06em] text-faint">
                        {row.score ? scoreBand(row.score.overall) : 'Not assessed'}
                      </p>
                    </div>
                  </div>
                  {row.score && (
                    <div className="mt-2">
                      <ScoreBreakdown score={row.score} compact />
                    </div>
                  )}
                </div>

                <div className="divide-y divide-line">
                  {requirementLabels.map((label) => {
                    const skill = all.find((s) => s.label === label)
                    if (!skill) return null
                    return (
                      <div key={label} className="px-4 py-2.5">
                        <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-faint">{label}</p>
                        <div className="mt-1">
                          <SkillStatusPill status={skill.status} support={skill.support} />
                        </div>
                        {skill.evidence ? (
                          <p className="mt-1.5 border-l-2 border-accent/60 bg-canvas py-1 pl-2 pr-1.5 body-copy text-[11px] leading-relaxed text-ink/80">
                            “{skill.evidence.quote}”
                          </p>
                        ) : (
                          <p className="mt-1.5 body-copy text-[11px] text-faint">No supporting excerpt found — not the same as missing skill.</p>
                        )}
                      </div>
                    )
                  })}
                </div>

                {row.gaps.length > 0 && (
                  <div className="border-t border-line px-4 py-2.5">
                    <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-faint">[ Gaps ]</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {row.gaps.map((g) => <Badge key={g} tone="warn">{g}</Badge>)}
                    </div>
                  </div>
                )}

                <div className="mt-auto border-t border-line px-4 py-2.5">
                  <Link to={`/recruiter/jobs/${jobId}/applicants`}>
                    <Button size="sm" variant="secondary" className="w-full">Back to ranked list</Button>
                  </Link>
                </div>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
