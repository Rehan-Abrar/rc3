import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BriefcaseBusiness, MapPin, Search, Sparkles, TriangleAlert } from 'lucide-react'
import { applications, jobs as jobsApi, resumeApi } from '../../lib/api'
import type { JobSummary } from '../../lib/types'
import { useAsync } from '../../lib/useAsync'
import { Badge, Button, Card, CardHeader, Dialog, EmptyState, ErrorState, Input, Skeleton } from '../../components/ui/core'
import { PageHeader } from '../../components/layout/AppShell'
import { useToast } from '../../components/ui/toast'
import { formatSalary } from '../../lib/utils'

export function JobsBrowsePage() {
  const { push } = useToast()
  const list = useAsync(() => jobsApi.list({ status: 'open' }), [])
  const resumes = useAsync(() => resumeApi.listMine(), [])
  const mine = useAsync(() => applications.mine(), [])
  const [q, setQ] = useState('')
  const [applyTo, setApplyTo] = useState<JobSummary | null>(null)
  const [resumeId, setResumeId] = useState<number | ''>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const appliedJobIds = new Set((mine.data ?? []).map((a) => a.job_id))
  const rows = (list.data ?? []).filter((j) => `${j.title} ${j.department} ${j.location}`.toLowerCase().includes(q.toLowerCase()))

  const openApply = (job: JobSummary) => {
    setApplyTo(job)
    setError(null)
    setResumeId(resumes.data?.[0]?.id ?? '')
  }

  const apply = async () => {
    if (!applyTo) return
    if (!resumeId) {
      setError('Upload a resume first, then apply.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await applications.apply(applyTo.id, Number(resumeId))
      push('Application submitted. Track its status under My applications.')
      setApplyTo(null)
      mine.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not apply.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Browse jobs"
        description="Only open roles are listed. Applying uses the resume you select, so keep it current."
        actions={
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" aria-hidden />
            <Input aria-label="Search open jobs" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search roles" className="h-8 w-56 pl-8 text-xs" />
          </div>
        }
      />

      {list.error ? (
        <Card><ErrorState message={list.error} onRetry={list.reload} /></Card>
      ) : list.loading ? (
        <div className="grid gap-3 md:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={<BriefcaseBusiness className="h-4 w-4" />} title="No open roles" body="Check back soon." /></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((j) => {
            const applied = appliedJobIds.has(j.id)
            return (
              <Card key={j.id} className="flex flex-col">
                <div className="border-b border-line px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-ink">{j.title}</h3>
                      <p className="text-micro text-faint">{j.department} · {j.employment_type}</p>
                    </div>
                    {applied ? <Badge tone="good">Applied</Badge> : <Badge tone="neutral">Open</Badge>}
                  </div>
                  <p className="mt-2 flex flex-wrap items-center gap-2 text-micro text-muted">
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {j.location}</span>
                    <span className="tnum">{formatSalary(j.salary_min, j.salary_max)}</span>
                  </p>
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-2.5">
                  <span className="text-micro text-faint">{j.applicant_count} applicants</span>
                  <Button size="sm" variant={applied ? 'secondary' : 'primary'} disabled={applied} onClick={() => openApply(j)}>
                    {applied ? 'Already applied' : 'Apply'}
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog
        open={Boolean(applyTo)}
        onClose={() => setApplyTo(null)}
        title={`Apply to ${applyTo?.title ?? ''}`}
        description="Your resume is parsed and assessed against the job requirements. A recruiter makes the decision."
        footer={
          <>
            <Button variant="ghost" onClick={() => setApplyTo(null)}>Cancel</Button>
            <Button variant="primary" loading={saving} onClick={apply}>Submit application</Button>
          </>
        }
      >
        <div className="space-y-3">
          {(resumes.data ?? []).length === 0 ? (
            <div className="rounded-lg border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn">
              You have no resume on file. <Link to="/candidate/resume" className="underline">Upload one first</Link>.
            </div>
          ) : (
            <div>
              <p className="label">Choose a resume</p>
              <div className="space-y-2">
                {(resumes.data ?? []).map((r) => (
                  <label key={r.id} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs ${resumeId === r.id ? 'border-accent/60 bg-accent/10' : 'border-line bg-canvas/50'}`}>
                    <input type="radio" name="resume" checked={resumeId === r.id} onChange={() => setResumeId(r.id)} className="accent-[rgb(125,156,255)]" />
                    <span className="min-w-0 flex-1 truncate text-ink">{r.filename}</span>
                    <span className="text-micro text-faint">{r.page_count}p</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <p className="flex items-start gap-1.5 text-micro text-faint">
            <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-accent" />
            You will see the exact status a recruiter sets. AI never rejects you automatically.
          </p>
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-xs text-bad" role="alert">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
            </div>
          )}
        </div>
      </Dialog>
    </div>
  )
}
