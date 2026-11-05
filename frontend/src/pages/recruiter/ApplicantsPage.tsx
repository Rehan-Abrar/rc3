import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ChevronDown, Columns3, Filter, ShieldAlert, SlidersHorizontal, Star } from 'lucide-react'
import { applications, auditApi, jobs as jobsApi, resumeFileUrl } from '../../lib/api'
import type { ApplicantRow, DuplicatePair } from '../../lib/types'
import { useAsync } from '../../lib/useAsync'
import { Badge, Button, Card, CardHeader, Dialog, EmptyState, ErrorState, Field, Input, Select, Skeleton } from '../../components/ui/core'
import { PageHeader } from '../../components/layout/AppShell'
import { useToast } from '../../components/ui/toast'
import { STAGE_LABEL, cn, stageTone } from '../../lib/utils'
import { ModeBadges, ScoreBreakdown, ScoreNumber, SkillMatrix, scoreBandLabel } from '../../components/ui/score'

/** Assessment is loaded only when a row is expanded — the list API stays light. */
function ApplicantAssessment({ applicationId }: { applicationId: number }) {
  const detail = useAsync(() => applications.detail(applicationId), [applicationId])
  if (detail.loading) {
    return (
      <div className="grid gap-3 p-4 lg:grid-cols-[260px_1fr]">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    )
  }
  if (detail.error) return <p className="border-t border-line px-4 py-3 text-xs text-bad">{detail.error}</p>
  const a = detail.data?.assessment
  if (!a) {
    return <p className="border-t border-line px-4 py-3 text-xs text-faint">No assessment yet. The pipeline will score this application once parsing finishes.</p>
  }
  return (
    <div className="grid gap-0 border-t border-line lg:grid-cols-[260px_1fr] animate-fade-in">
      <div className="border-b border-line px-4 py-3 lg:border-b-0 lg:border-r">
        <p className="mb-2 text-micro font-medium uppercase tracking-wider text-faint">Score breakdown</p>
        <ScoreBreakdown score={a} />
        <div className="mt-3 space-y-1.5">
          <ModeBadges score={a} />
        </div>
        <div className="mt-3 rounded-md bg-canvas/60 p-2.5">
          <p className="text-micro text-faint">Why this rank</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">{a.explanation || a.summary}</p>
        </div>
      </div>
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2">
          <p className="text-micro font-medium uppercase tracking-wider text-faint">Requirement evidence</p>
          <p className="max-w-md text-micro text-faint">{a.summary}</p>
        </div>
        <SkillMatrix skills={a.skills_detail} />
      </div>
    </div>
  )
}

export function ApplicantsPage() {
  const { id } = useParams()
  const jobId = Number(id)
  const navigate = useNavigate()
  const job = useAsync(() => jobsApi.get(jobId), [jobId])
  const list = useAsync(() => applications.forJob(jobId), [jobId])
  const { push } = useToast()

  const [q, setQ] = useState('')
  const [stage, setStage] = useState('all')
  const [minScore, setMinScore] = useState(0)
  const [hideThin, setHideThin] = useState(false)
  const [skill, setSkill] = useState('all')
  const [expanded, setExpanded] = useState<number | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const [override, setOverride] = useState<ApplicantRow | null>(null)
  const [overrideScore, setOverrideScore] = useState('')
  const [overrideReason, setOverrideReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const duplicates = useAsync(() => auditApi.duplicates(), [])
  const [dupPair, setDupPair] = useState<DuplicatePair | null>(null)
  const [merging, setMerging] = useState(false)

  const confirmMerge = async () => {
    if (!dupPair) return
    setMerging(true)
    try {
      const res = await auditApi.merge(dupPair.keep.id, dupPair.duplicate.id)
      push(
        `Merged ${dupPair.duplicate.name} into ${dupPair.keep.name}` +
          (res.applications_moved ? ` · ${res.applications_moved} application(s) moved.` : '.'),
      )
      setDupPair(null)
      duplicates.reload()
      list.reload()
    } catch (e) {
      push(e instanceof Error ? e.message : 'Could not merge.', 'error')
    } finally {
      setMerging(false)
    }
  }

  const rows = list.data ?? []
  const requirementLabels = useMemo(() => job.data?.requirements.map((r) => r.label) ?? [], [job.data])

  const filtered = rows.filter((r) => {
    if (q && !`${r.candidate.name} ${r.candidate.email}`.toLowerCase().includes(q.toLowerCase())) return false
    if (stage !== 'all' && r.stage !== stage) return false
    if (minScore > 0 && (r.score?.overall ?? 0) < minScore) return false
    if (hideThin && r.score?.insufficient_evidence) return false
    if (skill !== 'all' && !r.matched.includes(skill)) return false
    return true
  })

  const toggleSelect = (candidateId: number) =>
    setSelected((prev) => (prev.includes(candidateId) ? prev.filter((x) => x !== candidateId) : [...prev, candidateId].slice(0, 3)))

  const shortlist = async (row: ApplicantRow) => {
    setBusy(true)
    try {
      await applications.setStage(row.application_id, 'shortlisted', 'Shortlisted from ranked list after evidence review')
      push(`${row.candidate.name} shortlisted.`)
      list.reload()
    } catch (e) {
      push(e instanceof Error ? e.message : 'Could not shortlist.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const saveOverride = async () => {
    if (!override) return
    const n = Number(overrideScore)
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      push('Override score must be between 0 and 100.', 'error')
      return
    }
    if (!overrideReason.trim()) {
      push('Add a reason so the override is auditable.', 'error')
      return
    }
    setBusy(true)
    try {
      await applications.override(override.application_id, n, overrideReason.trim())
      push('Manual override saved with reason.')
      setOverride(null)
      setOverrideScore('')
      setOverrideReason('')
      list.reload()
    } catch (e) {
      push(e instanceof Error ? e.message : 'Could not save the override.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Applicants"
        description={job.data ? `${job.data.title} · ${rows.length} applications ranked by evidence` : 'Ranked by evidence-weighted relevance'}
        actions={
          <>
            <Link to={`/recruiter/jobs/${jobId}`}>
              <Button size="sm" variant="ghost"><ArrowLeft className="h-3.5 w-3.5" /> Job</Button>
            </Link>
            <Button
              size="sm"
              variant={selected.length >= 2 ? 'primary' : 'secondary'}
              disabled={selected.length < 2}
              onClick={() => navigate(`/recruiter/compare?job=${jobId}&ids=${selected.join(',')}`)}
            >
              <Columns3 className="h-3.5 w-3.5" /> Compare {selected.length ? `(${selected.length})` : ''}
            </Button>
          </>
        }
      />

      {(duplicates.data ?? []).length > 0 && (
        <Card className="mb-4 border-warn/30 bg-warn/[0.04] animate-fade-in">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden />
              <div>
                <p className="text-xs font-medium text-ink">
                  {duplicates.data!.length} possible duplicate {duplicates.data!.length === 1 ? 'record' : 'records'} detected
                </p>
                <p className="mt-0.5 text-micro text-muted">
                  {duplicates.data!.map((d) => `${d.keep.name} ↔ ${d.duplicate.name} · ${d.reason}`).join(' · ')}
                </p>
              </div>
            </div>
            <Button size="sm" variant="secondary" onClick={() => setDupPair(duplicates.data![0])}>Review</Button>
          </div>
        </Card>
      )}

      <Dialog
        open={Boolean(dupPair)}
        onClose={() => setDupPair(null)}
        title="Merge duplicate candidates?"
        description="Nothing is merged automatically. Confirm to keep one record and fold the other into it."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDupPair(null)}>Keep separate</Button>
            <Button variant="primary" loading={merging} onClick={confirmMerge}>Confirm merge</Button>
          </>
        }
      >
        {dupPair && (
          <div className="space-y-3 text-xs">
            <p className="text-muted">{dupPair.reason} ({Math.round(dupPair.similarity * 100)}% document similarity).</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="border border-good/25 bg-good/5 p-2.5">
                <p className="text-micro text-good">Keep</p>
                <p className="mt-0.5 font-medium text-ink">{dupPair.keep.name}</p>
                <p className="text-micro text-faint">{dupPair.keep.email}</p>
              </div>
              <div className="border border-line bg-canvas p-2.5">
                <p className="text-micro text-faint">Merge into keep</p>
                <p className="mt-0.5 font-medium text-ink">{dupPair.duplicate.name}</p>
                <p className="text-micro text-faint">{dupPair.duplicate.email}</p>
              </div>
            </div>
          </div>
        )}
      </Dialog>

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
          <div className="relative min-w-[180px] flex-1">
            <Input aria-label="Search applicants" placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} className="h-8 text-xs" />
          </div>
          <Button size="sm" variant={showFilters ? 'secondary' : 'ghost'} onClick={() => setShowFilters((v) => !v)}>
            <SlidersHorizontal className="h-3.5 w-3.5" /> Filters
          </Button>
          <span className="font-mono text-[10px] text-muted tnum">{filtered.length} / {rows.length}</span>
        </div>

        {showFilters && (
          <div className="grid gap-3 border-t border-line px-3 py-3 sm:grid-cols-2 lg:grid-cols-4 animate-fade-in">
            <label className="block">
              <span className="label">Stage</span>
              <Select value={stage} onChange={(e) => setStage(e.target.value)} className="h-8 text-xs">
                <option value="all">All stages</option>
                {Object.entries(STAGE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </label>
            <label className="block">
              <span className="label">Minimum score</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={minScore}
                  onChange={(e) => setMinScore(Number(e.target.value))}
                  className="w-full accent-[#0043CA]"
                  aria-label="Minimum score"
                />
                <span className="w-7 text-right text-xs text-muted tnum">{minScore}</span>
              </div>
            </label>
            <label className="block">
              <span className="label">Has evidence of</span>
              <Select value={skill} onChange={(e) => setSkill(e.target.value)} className="h-8 text-xs">
                <option value="all">Any requirement</option>
                {requirementLabels.map((l) => <option key={l} value={l}>{l}</option>)}
              </Select>
            </label>
            <label className="flex items-end gap-2 pb-1">
              <input
                type="checkbox"
                checked={hideThin}
                onChange={(e) => setHideThin(e.target.checked)}
                className="h-4 w-4 border-line bg-canvas accent-[#0043CA]"
              />
              <span className="text-xs text-muted">Hide insufficient evidence</span>
            </label>
          </div>
        )}
      </Card>

      {list.error ? (
        <Card><ErrorState message={list.error} onRetry={list.reload} /></Card>
      ) : list.loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Filter className="h-4 w-4" />}
            title="No applicants match these filters"
            body="Widen the score range or clear the stage filter."
            action={<Button size="sm" onClick={() => { setQ(''); setStage('all'); setMinScore(0); setSkill('all'); setHideThin(false) }}>Reset filters</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((r) => {
            const open = expanded === r.application_id
            const thin = r.score?.insufficient_evidence
            const rank = rows.findIndex((x) => x.application_id === r.application_id) + 1
            return (
              <Card key={r.application_id} className={cn('overflow-hidden transition-colors', open && 'border-faint/60')}>
                <div className="flex flex-wrap items-start gap-3 px-3 py-3 sm:px-4">
                  <div className="flex w-9 shrink-0 flex-col items-center pt-0.5">
                    <span className="mt-0.5 font-mono text-[11px] font-medium text-ink/45 tnum">{String(rank).padStart(2, '0')}</span>
                    <input
                      type="checkbox"
                      aria-label={`Select ${r.candidate.name} for comparison`}
                      checked={selected.includes(r.candidate.id)}
                      onChange={() => toggleSelect(r.candidate.id)}
                      className="mt-2 h-4 w-4 border-line bg-canvas accent-[#0043CA]"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/recruiter/applications/${r.application_id}`} className="text-sm font-semibold text-ink hover:text-accent">
                        {r.candidate.name}
                      </Link>
                      <Badge tone={stageTone(r.stage)}>{STAGE_LABEL[r.stage]}</Badge>
                      {thin && <Badge tone="warn"><ShieldAlert className="h-3 w-3" /> Thin evidence</Badge>}
                    </div>
                    <p className="mt-0.5 body-copy text-[11px] text-faint">
                      {r.candidate.email} ·{' '}
                      {r.resume_id ? (
                        <a
                          href={resumeFileUrl(r.resume_id)}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-accent hover:underline"
                        >
                          {r.resume_filename || 'view resume'}
                        </a>
                      ) : (
                        r.resume_filename || 'resume on file'
                      )}{' '}
                      · {r.has_notes ? 'private note' : 'no notes'}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {r.matched.slice(0, 6).map((m) => (
                        <span key={m} className="chip border-good/25 bg-good/8 text-good">{m}</span>
                      ))}
                      {r.missing.slice(0, 3).map((m) => (
                        <span key={m} className="chip border-line bg-canvas text-muted/80 line-through decoration-faint/60">{m}</span>
                      ))}
                    </div>
                  </div>

                  <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:flex-col sm:items-end">
                    <div className="text-right">
                      <ScoreNumber score={r.score} size="lg" />
                      <p className="mt-0.5 font-ui text-[10px] uppercase tracking-[0.06em] text-muted">{scoreBandLabel(r.score)}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => setExpanded(open ? null : r.application_id)} aria-expanded={open}>
                        Why? <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
                      </Button>
                      {!['shortlisted', 'interview', 'selected', 'rejected'].includes(r.stage) && (
                        <Button size="sm" variant="secondary" loading={busy} onClick={() => shortlist(r)}>
                          Shortlist
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => { setOverride(r); setOverrideScore(String(Math.round(r.score?.overall ?? 0))); setOverrideReason('') }}>
                        Override
                      </Button>
                    </div>
                  </div>
                </div>

                {open && <ApplicantAssessment applicationId={r.application_id} />}
              </Card>
            )
          })}
        </div>
      )}

      <Dialog
        open={Boolean(override)}
        onClose={() => setOverride(null)}
        title="Manual score override"
        description="Your override is stored with a reason so the decision stays auditable."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOverride(null)}>Cancel</Button>
            <Button variant="primary" loading={busy} onClick={saveOverride}>Save override</Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-muted">
            {override?.candidate.name} · AI score {override?.score ? Math.round(override.score.overall) : '—'}
          </p>
          <Field label="Override score (0–100)" htmlFor="ov-score">
            <Input id="ov-score" type="number" min={0} max={100} value={overrideScore} onChange={(e) => setOverrideScore(e.target.value)} className="tnum" />
          </Field>
          <Field label="Reason (required for the audit trail)" htmlFor="ov-reason">
            <Input id="ov-reason" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="Strong portfolio evidence not captured by the parser" />
          </Field>
        </div>
      </Dialog>
    </div>
  )
}
