import { useRef, useState } from 'react'
import { Check, FileText, Plus, RefreshCw, ShieldCheck, Upload, X } from 'lucide-react'
import { resumeApi, resumeFileUrl } from '../../lib/api'
import type { Resume } from '../../lib/types'
import { useAsync } from '../../lib/useAsync'
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, Field, Input, Skeleton } from '../../components/ui/core'
import { PageHeader } from '../../components/layout/AppShell'
import { useToast } from '../../components/ui/toast'
import { bytes, formatDate } from '../../lib/utils'

export function ResumePage() {
  const { push } = useToast()
  const list = useAsync(() => resumeApi.listMine(), [])
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [skillsDraft, setSkillsDraft] = useState<string[]>([])
  const [newSkill, setNewSkill] = useState('')
  const [saving, setSaving] = useState(false)

  const resume: Resume | null = list.data?.[0] ?? null
  const skills = resume?.extracted?.skills?.map((s) => s.label) ?? []

  const upload = async (file: File) => {
    setError(null)
    setUploading(true)
    try {
      await resumeApi.upload(file)
      push('Resume uploaded and parsed. Check the extracted skills below.')
      list.reload()
      setSkillsDraft([])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  const onFiles = (files: FileList | null) => {
    const file = files?.[0]
    if (file) void upload(file)
  }

  const addSkill = () => {
    const s = newSkill.trim()
    if (!s || skills.concat(skillsDraft).some((x) => x.toLowerCase() === s.toLowerCase())) return
    setSkillsDraft((prev) => [...prev, s])
    setNewSkill('')
  }

  const saveSkills = async () => {
    if (!resume) return
    setSaving(true)
    try {
      await resumeApi.updateSkills(resume.id, [...skills, ...skillsDraft])
      push('Skill corrections saved. Future assessments use them.')
      setSkillsDraft([])
      list.reload()
    } catch (e) {
      push(e instanceof Error ? e.message : 'Could not save corrections.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="My resume"
        description="The parser extracts quotes from your PDF or DOCX. You can correct the extracted skills — corrections are stored and used in future assessments."
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_1.1fr]">
        <Card>
          <CardHeader title="Upload" subtitle="PDF or DOCX · text-based, not a scan" />
          <div className="p-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); onFiles(e.dataTransfer.files) }}
              className={`flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center transition-colors ${
                dragging ? 'border-accent bg-accent/10' : 'border-line bg-canvas/40'
              }`}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-elevated text-faint">
                <Upload className="h-4 w-4" />
              </span>
              <p className="text-xs text-ink">Drag a PDF or DOCX here, or</p>
              <Button size="sm" variant="primary" loading={uploading} onClick={() => inputRef.current?.click()}>
                Choose file
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="sr-only"
                onChange={(e) => onFiles(e.target.files)}
              />
              <p className="text-micro text-faint">Files are parsed on the server. Unsupported or empty files return a readable message.</p>
            </div>

            {error && (
              <div className="mt-3 rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-xs text-bad" role="alert">{error}</div>
            )}

            {resume && (
              <div className="mt-3 rounded-lg border border-line bg-canvas/50 p-3">
                <p className="flex items-center gap-2 text-sm text-ink"><FileText className="h-4 w-4 text-faint" /> {resume.filename}<a href={resumeFileUrl(resume.id)} target="_blank" rel="noreferrer" className="ml-auto text-micro font-medium text-accent hover:underline">View file</a></p>
                <p className="mt-0.5 text-micro text-faint">
                  {resume.page_count} page(s) · {bytes(resume.size_bytes)} · uploaded {formatDate(resume.created_at, true)}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge tone={resume.parse_status === 'ok' ? 'good' : 'warn'}>parse: {resume.parse_status}</Badge>
                  <Badge tone="neutral">{resume.filename.toLowerCase().endsWith(".docx") ? "DOCX" : "PDF"}</Badge>
                </div>
                {resume.parse_status !== 'ok' && (
                  <p className="mt-2 text-micro text-warn">
                    {resume.parse_error ?? 'No readable text layer found.'} You can still correct the extracted skills below.
                  </p>
                )}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Extracted skills"
            subtitle={resume ? 'Click a skill to remove it, or add ones the parser missed' : 'Upload a resume to see extracted skills'}
          />
          {list.error ? (
            <ErrorState message={list.error} onRetry={list.reload} />
          ) : list.loading ? (
            <div className="space-y-2 p-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
          ) : !resume ? (
            <EmptyState icon={<FileText className="h-4 w-4" />} title="No resume yet" body="Upload a PDF to start the parsing pipeline." />
          ) : (
            <div className="space-y-3 p-4">
              <div className="flex flex-wrap gap-1.5">
                {skills.map((s) => (
                  <span key={s} className="chip border-good/25 bg-good/10 text-good">
                    <ShieldCheck className="h-3 w-3" /> {s}
                    <span className="text-good/70">quoted</span>
                  </span>
                ))}
                {skills.length === 0 && <p className="text-xs text-faint">No skills extracted yet. Add the important ones manually.</p>}
              </div>

              {skillsDraft.length > 0 && (
                <div>
                  <p className="text-micro text-faint">Pending corrections</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {skillsDraft.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSkillsDraft((prev) => prev.filter((x) => x !== s))}
                        className="chip border-accent/30 bg-accent/10 text-accent"
                        aria-label={`Remove ${s}`}
                      >
                        {s} <X className="h-3 w-3" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[180px] flex-1">
                  <Field label="Add a skill" htmlFor="new-skill">
                    <Input
                      id="new-skill"
                      value={newSkill}
                      onChange={(e) => setNewSkill(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); addSkill() }
                      }}
                      placeholder="e.g. PostgreSQL"
                    />
                  </Field>
                </div>
                <Button size="sm" onClick={addSkill} disabled={!newSkill.trim()}><Plus className="h-3.5 w-3.5" /> Add</Button>
                <Button size="sm" variant="primary" onClick={saveSkills} loading={saving} disabled={skillsDraft.length === 0}>
                  <Check className="h-3.5 w-3.5" /> Save corrections
                </Button>
              </div>

              <div className="rounded-lg border border-line bg-canvas/40 p-2.5">
                <p className="text-micro font-medium uppercase tracking-wider text-faint">Extracted profile</p>
                <p className="mt-1 text-xs text-muted">{resume.extracted?.name ?? '—'} · {resume.extracted?.email ?? '—'}</p>
                {resume.extracted?.links?.[0] && <p className="text-micro text-faint">{resume.extracted.links[0]}</p>}
              </div>

              <details className="rounded-lg border border-line bg-canvas/40 p-2.5">
                <summary className="flex cursor-pointer items-center gap-1.5 text-xs text-muted">
                  <RefreshCw className="h-3 w-3" /> View extracted resume text
                </summary>
                <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-canvas p-2 text-micro leading-relaxed text-muted">
                  {resume.raw_text}
                </pre>
              </details>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
