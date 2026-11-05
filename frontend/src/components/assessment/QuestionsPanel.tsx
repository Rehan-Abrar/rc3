import { useState } from 'react'
import { Check, Pencil, RefreshCw, Sparkles, Trash2, X } from 'lucide-react'
import type { InterviewQuestion } from '../../lib/types'
import { questionApi } from '../../lib/api'
import { useAsync } from '../../lib/useAsync'
import { Badge, Button, EmptyState, ErrorState, Skeleton, Textarea } from '../ui/core'
import { useToast } from '../ui/toast'
import { cn } from '../../lib/utils'

const GROUPS: Array<{ key: InterviewQuestion['difficulty']; label: string; tone: 'good' | 'warn' | 'bad' }> = [
  { key: 'beginner', label: 'Beginner', tone: 'good' },
  { key: 'intermediate', label: 'Intermediate', tone: 'warn' },
  { key: 'advanced', label: 'Advanced', tone: 'bad' },
]

export function QuestionsPanel({ applicationId }: { applicationId: number }) {
  const { push } = useToast()
  const list = useAsync(() => questionApi.list(applicationId), [applicationId])
  const [generating, setGenerating] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [openGuideline, setOpenGuideline] = useState<number | null>(null)

  const generate = async () => {
    setGenerating(true)
    try {
      await questionApi.generate(applicationId)
      push('Generated a new question set with answer guidelines.', 'info')
      list.reload()
    } catch (e) {
      push(e instanceof Error ? e.message : 'Generation failed.', 'error')
    } finally {
      setGenerating(false)
    }
  }

  const save = async (q: InterviewQuestion) => {
    if (!draft.trim()) return
    setSaving(true)
    try {
      await questionApi.update(q.id, { text: draft.trim() })
      setEditing(null)
      list.reload()
    } catch (e) {
      push(e instanceof Error ? e.message : 'Could not save.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (q: InterviewQuestion) => {
    try {
      await questionApi.remove(q.id)
      push('Question removed.')
      list.reload()
    } catch (e) {
      push(e instanceof Error ? e.message : 'Could not remove.', 'error')
    }
  }

  const questions = list.data ?? []

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <p className="text-micro font-medium uppercase tracking-wider text-faint">
          Interview questions <span className="text-faint/70">({questions.length})</span>
        </p>
        <Button size="sm" onClick={generate} loading={generating}>
          <Sparkles className="h-3.5 w-3.5" /> {questions.length ? 'Regenerate' : 'Generate with AI'}
        </Button>
      </div>

      {list.error ? (
        <ErrorState message={list.error} onRetry={list.reload} />
      ) : list.loading ? (
        <div className="space-y-2 p-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : questions.length === 0 ? (
        <EmptyState title="No questions yet" body="Generate role-specific questions with difficulty levels and answer guidelines." />
      ) : (
        <div className="divide-y divide-line">
          {GROUPS.map((g) => {
            const items = questions.filter((q) => q.difficulty === g.key)
            if (items.length === 0) return null
            return (
              <div key={g.key} className="px-4 py-3">
                <div className="mb-2 flex items-center gap-2">
                  <Badge tone={g.tone}>{g.label}</Badge>
                  <span className="text-micro text-faint">{items.length} question{items.length === 1 ? '' : 's'}</span>
                </div>
                <ul className="space-y-2">
                  {items.map((q) => (
                    <li key={q.id} className="border border-line bg-canvas p-2.5">
                      {editing === q.id ? (
                        <div>
                          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} aria-label="Edit question" />
                          <div className="mt-2 flex justify-end gap-1.5">
                            <Button size="sm" variant="ghost" onClick={() => setEditing(null)}><X className="h-3.5 w-3.5" /> Cancel</Button>
                            <Button size="sm" variant="primary" loading={saving} onClick={() => save(q)}><Check className="h-3.5 w-3.5" /> Save</Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm leading-snug text-ink">{q.text}</p>
                            <div className="flex shrink-0 gap-0.5">
                              <Button size="sm" variant="ghost" aria-label="Edit question" onClick={() => { setEditing(q.id); setDraft(q.text) }}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" aria-label="Remove question" onClick={() => remove(q)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <span className="text-micro text-faint capitalize">{q.category} · {q.source === 'ai' ? 'AI generated' : 'edited by you'}</span>
                            <button
                              type="button"
                              className="text-micro text-accent hover:underline"
                              onClick={() => setOpenGuideline(openGuideline === q.id ? null : q.id)}
                              aria-expanded={openGuideline === q.id}
                            >
                              {openGuideline === q.id ? 'Hide guideline' : 'Answer guideline'}
                            </button>
                          </div>
                          {openGuideline === q.id && (
                            <p className={cn('mt-2 rounded-md bg-elevated/60 px-2.5 py-2 text-xs leading-relaxed text-muted animate-fade-in')}>
                              {q.guideline}
                            </p>
                          )}
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}
      <div className="flex items-center gap-2 border-t border-line px-4 py-2">
        <RefreshCw className={cn('h-3 w-3 text-faint', generating && 'animate-spin')} aria-hidden />
        <p className="text-micro text-faint">AI drafts questions from this candidate's evidence. Edit anything before the interview.</p>
      </div>
    </div>
  )
}
