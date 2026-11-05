import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2, Plus, Sparkles, Trash2, Wand2 } from 'lucide-react'
import { jobs as jobsApi } from '../../lib/api'
import type { JobInput, Requirement } from '../../lib/types'
import { Badge, Button, Card, CardHeader, ErrorState, Field, Input, Select, Skeleton, Textarea } from '../../components/ui/core'
import { PageHeader } from '../../components/layout/AppShell'
import { useToast } from '../../components/ui/toast'
import { useAsync } from '../../lib/useAsync'

type Req = JobInput['requirements'][number]

const emptyReq = (): Req => ({ label: '', kind: 'skill', importance: 'required', weight: 1, min_years: null, evidence_hint: null })

const blank: JobInput = {
  title: '',
  department: '',
  location: '',
  employment_type: 'Full-time',
  salary_min: null,
  salary_max: null,
  description: '',
  requirements: [],
}

const TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship']

export function JobEditorPage() {
  const { id } = useParams()
  const editing = Boolean(id)
  const nav = useNavigate()
  const { push } = useToast()
  const existing = useAsync(() => (id ? jobsApi.get(Number(id)) : Promise.resolve(null)), [id])

  const [form, setForm] = useState<JobInput>(blank)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [suggested, setSuggested] = useState<Req[] | null>(null)

  useEffect(() => {
    const job = existing.data
    if (!job) return
    setForm({
      title: job.title,
      department: job.department ?? '',
      location: job.location ?? '',
      employment_type: job.employment_type ?? 'Full-time',
      salary_min: job.salary_min,
      salary_max: job.salary_max,
      description: job.description,
      requirements: job.requirements.map((r: Requirement) => ({
        label: r.label,
        kind: r.kind,
        importance: r.importance,
        weight: r.weight,
        min_years: r.min_years,
        evidence_hint: r.evidence_hint,
      })),
    })
  }, [existing.data])

  const set = <K extends keyof JobInput>(key: K, value: JobInput[K]) => setForm((f) => ({ ...f, [key]: value }))

  const updateReq = (index: number, patch: Partial<Req>) =>
    setForm((f) => ({ ...f, requirements: f.requirements.map((r, i) => (i === index ? { ...r, ...patch } : r)) }))

  const countRequired = useMemo(() => form.requirements.filter((r) => r.importance === 'required' && r.label.trim()).length, [form.requirements])

  const validate = () => {
    const next: Record<string, string> = {}
    if (!form.title.trim()) next.title = 'Give the role a title.'
    if (!form.description.trim() || form.description.trim().length < 40) next.description = 'Add a description of at least 40 characters so AI extraction has something to read.'
    if (form.requirements.filter((r) => r.label.trim()).length === 0) next.requirements = 'Add at least one skill or qualification.'
    if (countRequired === 0) next.requirements = 'Mark at least one requirement as required.'
    if (form.salary_min != null && form.salary_max != null && form.salary_min > form.salary_max) next.salary = 'Minimum salary cannot exceed maximum.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const save = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const payload: JobInput = {
        ...form,
        title: form.title.trim(),
        requirements: form.requirements
          .filter((r) => r.label.trim())
          .map((r) => ({ ...r, label: r.label.trim(), weight: r.importance === 'required' ? r.weight || 1 : r.weight || 0.5 })),
      }
      const job = editing ? await jobsApi.update(Number(id), payload) : await jobsApi.create(payload)
      push(editing ? 'Job updated.' : 'Job published. It is now visible to candidates.')
      nav(`/recruiter/jobs/${job.id}`)
    } catch (e) {
      push(e instanceof Error ? e.message : 'Could not save the job.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const extract = async () => {
    if (form.description.trim().length < 40) {
      setErrors((e) => ({ ...e, description: 'Write a description first — the extractor reads it.' }))
      return
    }
    setExtracting(true)
    try {
      const res = await jobsApi.extract({ description: form.description })
      setSuggested(res.requirements)
      push(`AI proposed ${res.requirements.length} requirements. Review before adding.`, 'info')
    } catch (e) {
      push(e instanceof Error ? e.message : 'Extraction failed.', 'error')
    } finally {
      setExtracting(false)
    }
  }

  const acceptSuggestion = (req: Req) => {
    setForm((f) => ({ ...f, requirements: [...f.requirements, req] }))
    setSuggested((prev) => (prev ?? []).filter((r) => r.label !== req.label))
  }

  const acceptAll = () => {
    setForm((f) => ({ ...f, requirements: [...f.requirements, ...(suggested ?? [])] }))
    setSuggested(null)
  }

  if (existing.error) {
    return <Card><ErrorState message={existing.error} onRetry={existing.reload} /></Card>
  }

  return (
    <div>
      <PageHeader
        title={editing ? 'Edit job' : 'Post a job'}
        description="Requirements drive the matching model. Be explicit about what is required versus preferred."
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => nav(-1)}>
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Button>
            <Button variant="primary" size="sm" onClick={save} loading={saving}>
              {editing ? 'Save changes' : 'Publish job'}
            </Button>
          </>
        }
      />

      {existing.loading && editing ? (
        <div className="space-y-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-64" />
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
          <div className="space-y-4">
            <Card>
              <CardHeader title="Role details" />
              <div className="grid gap-3 p-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field label="Job title" htmlFor="title" required error={errors.title}>
                    <Input id="title" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Backend Developer" />
                  </Field>
                </div>
                <Field label="Department" htmlFor="department">
                  <Input id="department" value={form.department ?? ''} onChange={(e) => set('department', e.target.value)} placeholder="Platform Engineering" />
                </Field>
                <Field label="Location" htmlFor="location">
                  <Input id="location" value={form.location ?? ''} onChange={(e) => set('location', e.target.value)} placeholder="Remote (EU)" />
                </Field>
                <Field label="Employment type" htmlFor="type">
                  <Select id="type" value={form.employment_type ?? 'Full-time'} onChange={(e) => set('employment_type', e.target.value)}>
                    {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </Select>
                </Field>
                <div>
                  <span className="label">Salary range (EUR)</span>
                  <div className="flex items-center gap-2">
                    <Input
                      aria-label="Minimum salary"
                      type="number"
                      min={0}
                      value={form.salary_min ?? ''}
                      onChange={(e) => set('salary_min', e.target.value ? Number(e.target.value) : null)}
                      placeholder="78000"
                      className="tnum"
                    />
                    <span className="text-faint" aria-hidden>–</span>
                    <Input
                      aria-label="Maximum salary"
                      type="number"
                      min={0}
                      value={form.salary_max ?? ''}
                      onChange={(e) => set('salary_max', e.target.value ? Number(e.target.value) : null)}
                      placeholder="98000"
                      className="tnum"
                    />
                  </div>
                  {errors.salary && <p className="mt-1 text-xs text-bad">{errors.salary}</p>}
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader
                title="Description"
                subtitle="Free text. The AI extractor proposes skills from it, but you stay in control."
                actions={
                  <Button size="sm" onClick={extract} loading={extracting}>
                    <Sparkles className="h-3.5 w-3.5" /> Extract with AI
                  </Button>
                }
              />
              <div className="p-4">
                <Field label="Job description" htmlFor="description" required error={errors.description}>
                  <Textarea
                    id="description"
                    value={form.description}
                    onChange={(e) => set('description', e.target.value)}
                    rows={9}
                    placeholder="We are hiring a Backend Developer to design Django REST APIs, model data in PostgreSQL and ship containerised services with Docker…"
                  />
                </Field>
                <p className="mt-1 text-micro text-faint">{form.description.trim().length} characters</p>

                {suggested && (
                  <div className="mt-3 rounded-lg border border-accent/30 bg-accent/5 p-3 animate-rise-in">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-medium text-ink">
                        AI proposed {suggested.length} requirements
                        <span className="ml-1.5 text-micro font-normal text-faint">review before adding</span>
                      </p>
                      {suggested.length > 0 && (
                        <Button size="sm" variant="primary" onClick={acceptAll}>
                          <Plus className="h-3.5 w-3.5" /> Add all
                        </Button>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {suggested.length === 0 && <p className="text-micro text-muted">All suggestions are already in the list.</p>}
                      {suggested.map((r) => (
                        <button
                          key={r.label}
                          type="button"
                          onClick={() => acceptSuggestion(r)}
                          className="chip border-accent/30 bg-accent/10 text-accent transition-colors hover:bg-accent/20"
                        >
                          <Plus className="h-3 w-3" /> {r.label}
                          <span className="text-accent/60">{r.importance}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader
                title="Requirements"
                subtitle={`${countRequired} required · ${form.requirements.length} total`}
                actions={
                  <Button size="sm" onClick={() => setForm((f) => ({ ...f, requirements: [...f.requirements, emptyReq()] }))}>
                    <Plus className="h-3.5 w-3.5" /> Add
                  </Button>
                }
              />
              <div className="space-y-3 p-4">
                {errors.requirements && <p className="text-xs text-bad" role="alert">{errors.requirements}</p>}
                {form.requirements.length === 0 && (
                  <p className="text-xs text-faint">No requirements yet. Add skills manually or extract them from the description.</p>
                )}
                {form.requirements.map((r, i) => (
                  <div key={i} className="rounded-lg border border-line bg-canvas/50 p-2.5">
                    <div className="flex items-center gap-2">
                      <Input
                        aria-label={`Requirement ${i + 1} label`}
                        value={r.label}
                        onChange={(e) => updateReq(i, { label: e.target.value })}
                        placeholder="Python"
                        className="h-8 flex-1 text-xs"
                      />
                      <Button size="sm" variant="ghost" aria-label={`Remove ${r.label || 'requirement'}`} onClick={() => setForm((f) => ({ ...f, requirements: f.requirements.filter((_, idx) => idx !== i) }))}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <label className="block">
                        <span className="text-micro text-faint">Importance</span>
                        <Select
                          aria-label="Importance"
                          value={r.importance}
                          onChange={(e) => updateReq(i, { importance: e.target.value as Req['importance'] })}
                          className="mt-0.5 h-7 text-micro"
                        >
                          <option value="required">Required</option>
                          <option value="preferred">Preferred</option>
                        </Select>
                      </label>
                      <label className="block">
                        <span className="text-micro text-faint">Kind</span>
                        <Select
                          aria-label="Kind"
                          value={r.kind ?? 'skill'}
                          onChange={(e) => updateReq(i, { kind: e.target.value as 'skill' | 'qualification' })}
                          className="mt-0.5 h-7 text-micro"
                        >
                          <option value="skill">Skill</option>
                          <option value="qualification">Qualification</option>
                        </Select>
                      </label>
                      <label className="block">
                        <span className="text-micro text-faint">Min years</span>
                        <Input
                          aria-label="Minimum years"
                          type="number"
                          min={0}
                          step={0.5}
                          value={r.min_years ?? ''}
                          onChange={(e) => updateReq(i, { min_years: e.target.value ? Number(e.target.value) : null })}
                          className="mt-0.5 h-7 text-micro tnum"
                          placeholder="—"
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader title="How scoring works" />
              <div className="space-y-2 p-4 text-xs text-muted">
                <p><span className="text-ink">Skills 50%</span> · weighted per requirement (required 1.0, preferred 0.4–0.6).</p>
                <p><span className="text-ink">Experience 25%</span> · evidenced years against the minimum.</p>
                <p><span className="text-ink">Projects 15%</span> · semantic relevance to this description.</p>
                <p><span className="text-ink">Qualifications 10%</span> · matched degrees and certifications.</p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Badge tone="good">Matched</Badge>
                  <Badge tone="warn">Partial</Badge>
                  <Badge>Missing evidence</Badge>
                  <Badge tone="bad">Confirmed absent</Badge>
                </div>
                <p className="text-micro text-faint">Missing evidence is not treated as absence of skill. Only explicit statements or recruiter edits mark a skill as confirmed absent.</p>
              </div>
            </Card>

            <div className="flex items-center justify-between gap-2">
              <Button variant="ghost" onClick={() => nav(-1)}>Cancel</Button>
              <Button variant="primary" onClick={save} loading={saving}>
                <Wand2 className="h-3.5 w-3.5" /> {editing ? 'Save changes' : 'Publish job'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
