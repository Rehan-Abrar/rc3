import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Mail,
  MessageSquarePlus,
  ShieldCheck,
  Sparkles,
  Star,
  XCircle,
} from 'lucide-react'
import { applications } from '../../lib/api'
import type { ApplicationDetail, Stage } from '../../lib/types'
import { useAsync } from '../../lib/useAsync'
import { Badge, Button, Card, CardHeader, Dialog, EmptyState, ErrorState, Field, Skeleton, Textarea } from '../../components/ui/core'
import { PageHeader } from '../../components/layout/AppShell'
import { useToast } from '../../components/ui/toast'
import { STAGE_LABEL, bytes, formatDate, formatRelative, stageTone } from '../../lib/utils'
import { AssessmentSummary, ModeBadges, ScoreBreakdown, ScoreNumber, SkillMatrix, scoreBandLabel } from '../../components/ui/score'
import { QuestionsPanel } from '../../components/assessment/QuestionsPanel'
import { InterviewPanel } from '../../components/assessment/InterviewPanel'

export function ApplicationDetailPage() {
  const { id } = useParams()
  const appId = Number(id)
  const nav = useNavigate()
  const { push } = useToast()
  const detail = useAsync(() => applications.detail(appId), [appId])
  const [stageDialog, setStageDialog] = useState<{ stage: Stage; title: string; body: string } | null>(null)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)

  const d = detail.data

  const runStage = async () => {
    if (!stageDialog) return
    if (!reason.trim()) {
      push('Add a reason for the audit trail.', 'error')
      return
    }
    setSaving(true)
    try {
      await applications.setStage(appId, stageDialog.stage, reason.trim())
      push(`Stage updated to ${STAGE_LABEL[stageDialog.stage]}.`)
      setStageDialog(null)
      setReason('')
      detail.reload()
    } catch (e) {
      push(e instanceof Error ? e.message : 'Could not update the stage.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const addNote = async () => {
    if (!note.trim()) return
    setNoteSaving(true)
    try {
      await applications.addNote(appId, note.trim())
      setNote('')
      push('Private note added. Only recruiters can see it.')
      detail.reload()
    } catch (e) {
      push(e instanceof Error ? e.message : 'Could not add the note.', 'error')
    } finally {
      setNoteSaving(false)
    }
  }

  if (detail.error) return <Card><ErrorState message={detail.error} onRetry={detail.reload} /></Card>
  if (detail.loading || !d) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20" />
        <div className="grid gap-3 xl:grid-cols-[1.5fr_1fr]">
          <Skeleton className="h-96" />
          <Skeleton className="h-72" />
        </div>
      </div>
    )
  }

  const a = d as ApplicationDetail
  const assessment = a.assessment
  const actionable: Array<{ stage: Stage; label: string; variant: 'primary' | 'danger' | 'secondary'; icon: typeof CheckCircle2; body: string }> = []
  if (['submitted', 'parsed', 'assessed', 'recruiter_review'].includes(a.stage)) {
    actionable.push({ stage: 'shortlisted', label: 'Shortlist', variant: 'primary', icon: CheckCircle2, body: 'Move this candidate into the shortlist. They stay in the pipeline for interview scheduling.' })
  }
  if (['shortlisted', 'interview'].includes(a.stage)) {
    actionable.push({ stage: 'selected', label: 'Mark selected', variant: 'primary', icon: Star, body: 'Record a final selection. This is a human decision and is stored with your reason.' })
  }
  if (!['rejected', 'selected'].includes(a.stage)) {
    actionable.push({ stage: 'rejected', label: 'Reject', variant: 'danger', icon: XCircle, body: 'Reject this application. The candidate sees the status change; no automated rejection happens anywhere.' })
  }

  return (
    <div>
      <button type="button" onClick={() => nav(-1)} className="mb-2 inline-flex items-center gap-1 text-xs text-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </button>

      <PageHeader
        title={a.candidate.full_name}
        description={`${a.job.title} · applied ${formatRelative(a.created_at)}`}
        meta={
          <>
            <Badge tone={stageTone(a.stage)} dot>{STAGE_LABEL[a.stage]}</Badge>
            {a.override_score != null && <Badge tone="accent"><Star className="h-3 w-3" /> Manual override {Math.round(a.override_score)}</Badge>}
            {assessment && <Badge tone="neutral">AI score {Math.round(assessment.overall)}</Badge>}
          </>
        }
        actions={
          <>
            {actionable.map((x) => (
              <Button
                key={x.stage}
                size="sm"
                variant={x.variant}
                onClick={() => { setStageDialog({ stage: x.stage, title: x.label, body: x.body }); setReason('') }}
              >
                <x.icon className="h-3.5 w-3.5" /> {x.label}
              </Button>
            ))}
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Evidence-based assessment"
              subtitle={assessment ? scoreBandLabel(assessment) : 'Not assessed yet'}
              actions={
                <>
                  {assessment && <ScoreNumber score={assessment} size="lg" />}
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={detail.loading}
                    onClick={async () => {
                      try {
                        await applications.reassess(appId)
                        push('Assessment recomputed from the resume evidence.')
                        detail.reload()
                      } catch (e) {
                        push(e instanceof Error ? e.message : 'Could not recompute the assessment.', 'error')
                      }
                    }}
                  >
                    <Sparkles className="h-3.5 w-3.5" /> Recompute
                  </Button>
                </>
              }
            />
            {!assessment ? (
              <EmptyState title="No assessment" body="Run the assessment to see weighted scores and resume evidence." />
            ) : (
              <>
                <div className="grid gap-0 md:grid-cols-[240px_1fr]">
                  <div className="border-b border-line px-4 py-3 md:border-b-0 md:border-r">
                    <p className="mb-2 text-micro font-medium uppercase tracking-wider text-faint">Weighted breakdown</p>
                    <ScoreBreakdown score={assessment} />
                    <div className="mt-3 space-y-1.5">
                      <ModeBadges score={assessment} />
                    </div>
                    {assessment.insufficient_evidence && (
                      <p className="mt-2 rounded-md border border-warn/30 bg-warn/10 px-2.5 py-1.5 text-micro leading-relaxed text-warn">
                        Too little verified evidence for a precise score. Treat this as a band, not a verdict.
                      </p>
                    )}
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-micro font-medium uppercase tracking-wider text-faint">Why this candidate</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{assessment.summary}</p>
                    {assessment.explanation && <p className="mt-2 text-xs leading-relaxed text-faint">{assessment.explanation}</p>}
                    <div className="mt-3 flex items-center gap-1.5 text-micro text-faint">
                      <ShieldCheck className="h-3 w-3 text-good" /> Every claim is tied to a resume excerpt
                      <span aria-hidden>·</span>
                      <span className="capitalize">{assessment.model}</span>
                    </div>
                  </div>
                </div>
                <div className="border-t border-line">
                  <div className="px-4 py-2">
                    <p className="text-micro font-medium uppercase tracking-wider text-faint">Requirement evidence</p>
                  </div>
                  <SkillMatrix skills={assessment.skills_detail} />
                </div>
              </>
            )}
          </Card>

          <Card className="overflow-hidden">
            <QuestionsPanel applicationId={appId} />
          </Card>

          <Card className="overflow-hidden">
            <InterviewPanel applicationId={appId} candidateName={a.candidate.full_name} jobTitle={a.job.title} />
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Candidate" />
            <div className="space-y-2 px-4 py-3 text-xs">
              <p className="flex items-center gap-2 text-muted">
                <Mail className="h-3.5 w-3.5 text-faint" />
                <a href={`mailto:${a.candidate.email}`} className="hover:text-ink">{a.candidate.email}</a>
              </p>
              {a.resume && (
                <div className="rounded-lg border border-line bg-canvas/50 p-2.5">
                  <p className="flex items-center gap-2 text-ink">
                    <FileText className="h-3.5 w-3.5 text-faint" /> {a.resume.filename}
                  </p>
                  <p className="mt-0.5 text-micro text-faint">
                    {a.resume.page_count} page(s) · {bytes(a.resume.size_bytes)} · parse {a.resume.parse_status}
                  </p>
                  {a.resume.parse_status !== 'ok' && (
                    <p className="mt-1 text-micro text-warn">{a.resume.parse_error ?? 'Extraction needs a manual correction.'}</p>
                  )}
                </div>
              )}
              <p className="text-micro text-faint">
                Application #{a.id} · updated {formatDate(a.updated_at, true)}
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Private notes" subtitle="Recruiter-only, never shown to candidates" />
            <div className="space-y-2 px-4 py-3">
              {a.notes.length === 0 ? (
                <p className="text-xs text-faint">No notes yet.</p>
              ) : (
                a.notes.map((n) => (
                  <div key={n.id} className="rounded-lg border border-line bg-canvas/50 p-2.5">
                    <p className="text-xs leading-relaxed text-muted">{n.body}</p>
                    <p className="mt-1 text-micro text-faint">{n.author_name ?? 'Recruiter'} · {formatRelative(n.created_at)}</p>
                  </div>
                ))
              )}
              <Field label="Add a note" htmlFor="note">
                <Textarea
                  id="note"
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Evidence you want the team to see before the interview…"
                />
              </Field>
              <Button size="sm" variant="secondary" loading={noteSaving} onClick={addNote} disabled={!note.trim()}>
                <MessageSquarePlus className="h-3.5 w-3.5" /> Add note
              </Button>
            </div>
          </Card>

          <Card>
            <CardHeader title="Audit trail" subtitle="Every status change with actor and reason" />
            <ol className="relative px-4 py-3">
              {a.events.length === 0 ? (
                <p className="text-xs text-faint">No events recorded.</p>
              ) : (
                a.events.map((e, i) => (
                  <li key={e.id} className="relative flex gap-3 pb-3 last:pb-0">
                    <span className="relative flex w-3 shrink-0 justify-center">
                      <span className={`mt-1 h-1.5 w-1.5 rounded-full ${i === 0 ? 'bg-accent' : 'bg-line'}`} />
                      {i !== a.events.length - 1 && <span className="absolute top-3 h-full w-px bg-line" aria-hidden />}
                    </span>
                    <div className="min-w-0 pb-1">
                      <p className="text-xs text-ink">
                        {e.from_stage ? `${STAGE_LABEL[e.from_stage]} → ` : ''}
                        {STAGE_LABEL[e.to_stage]}
                      </p>
                      {e.reason && <p className="mt-0.5 text-micro leading-snug text-muted">{e.reason}</p>}
                      <p className="mt-0.5 text-micro text-faint">{e.actor_name ?? 'System'} · {formatDate(e.created_at, true)}</p>
                    </div>
                  </li>
                ))
              )}
            </ol>
          </Card>
        </div>
      </div>

      <Dialog
        open={Boolean(stageDialog)}
        onClose={() => setStageDialog(null)}
        title={stageDialog?.title ?? ''}
        description={stageDialog?.body}
        footer={
          <>
            <Button variant="ghost" onClick={() => setStageDialog(null)}>Cancel</Button>
            <Button variant={stageDialog?.stage === 'rejected' ? 'danger' : 'primary'} loading={saving} onClick={runStage}>
              Confirm
            </Button>
          </>
        }
      >
        <Field label="Reason (required)" htmlFor="stage-reason" hint="Stored in the audit trail and visible to your team.">
          <Textarea id="stage-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Clear evidence on all required backend skills…" />
        </Field>
      </Dialog>
    </div>
  )
}
