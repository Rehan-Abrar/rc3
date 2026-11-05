import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BriefcaseBusiness, MapPin, Search, Sparkles, TriangleAlert } from 'lucide-react'
import { applications, jobs as jobsApi, resumeApi } from '../../lib/api'
import type { JobSummary } from '../../lib/types'
import { useAsync } from '../../lib/useAsync'
import { Badge, Button, Card, CardHeader, Dialog, EmptyState, ErrorState, Input, Skeleton } from '../../components/ui/core'
import { PageHeader } from '../../components/layout/AppShell'
import { useToast } from '../../components/ui/toast'
import { employmentLabel, formatSalary } from '../../lib/utils'

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
          {rows.map((j, index) => {
            const applied = appliedJobIds.has(j.id)
            return (
              <Card key={j.id} className="flex flex-col">
                <div className="flex-1 px-4 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-faint">
                      Role {String(index + 1).padStart(2, '0')}
                    </span>
                    {applied ? <Badge tone="good">Applied</Badge> : <Badge tone="accent">Open</Badge>}
                  </div>
                  <h3 className="mt-1.5 font-display text-[17px] font-medium leading-snug text-ink">{j.title}</h3>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.06em] text-muted">
                    {j.department} · {employmentLabel(j.employment_type)}
                  </p>
                  <p className="mt-2 flex flex-wrap items-center gap-3 body-copy text-[11px] text-muted">
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3 text-faint" /> {j.location}</span>
                    <span className="tnum">{formatSalary(j.salary_min, j.salary_max)}</span>
                  </p>
                </div>
                <div className="grid grid-cols-3 divide-x divide-line border-t border-line">
                  {[
                    ['Applicants', j.applicant_count],
                    ['Shortlisted', j.shortlisted_count],
                    ['Interviews', j.interview_count],
                  ].map(([label, value]) => (
                    <div key={label as string} className="px-3 py-2">
                      <p className="font-display text-lg font-light leading-none text-ink tnum">{value}</p>
                      <p className="mt-1 font-ui text-[9px] uppercase tracking-[0.08em] text-faint">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-3">
                  <span className="body-copy text-[11px] text-faint">Your resume is assessed, never auto-rejected.</span>
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
            <div className="border border-warn/30 bg-warn/5 px-3 py-2 text-xs text-warn">
              You have no resume on file. <Link to="/candidate/resume" className="underline">Upload one first</Link>.
            </div>
          ) : (
            <div>
              <p className="label">Choose a resume</p>
              <div className="space-y-2">
                {(resumes.data ?? []).map((r) => (
                  <label key={r.id} className={`flex cursor-pointer items-center gap-2 border px-3 py-2 body-copy text-xs ${resumeId === r.id ? 'border-accent bg-accent/8' : 'border-line bg-canvas'}`}>
                    <input type="radio" name="resume" checked={resumeId === r.id} onChange={() => setResumeId(r.id)} className="accent-[#0043CA]" />
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
            <div className="flex items-start gap-2 border border-bad/30 bg-bad/5 px-3 py-2 text-xs text-bad" role="alert">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
            </div>
          )}
        </div>
      </Dialog>
    </div>
  )
}
