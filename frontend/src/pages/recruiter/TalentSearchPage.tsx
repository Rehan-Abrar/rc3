import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Columns3, Search, Sparkles, Waves } from 'lucide-react'
import { talentApi } from '../../lib/api'
import type { TalentSearchResult } from '../../lib/types'
import { ApiError } from '../../lib/api'
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, Input, Skeleton } from '../../components/ui/core'
import { PageHeader } from '../../components/layout/AppShell'
import { cn } from '../../lib/utils'

const EXAMPLES = [
  'Python developers with REST API experience',
  'Django and PostgreSQL production work',
  'React TypeScript design systems',
]

export function TalentSearchPage() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [result, setResult] = useState<TalentSearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<number[]>([])

  const run = async (query: string) => {
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await talentApi.search(query.trim())
      setResult(res)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Search failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const toggle = (id: number) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(0, 3)))

  return (
    <div>
      <PageHeader
        title="Talent search"
        description="Ask in plain language. The query is turned into requirements, then resumes are ranked by embedding similarity — not keyword overlap."
        meta={
          result && (
            <>
              <Badge tone="neutral">Mode: {result.mode === 'dense' ? 'dense embeddings' : 'lexical fallback'}</Badge>
              <Badge tone="neutral">{result.hits.length} candidates</Badge>
            </>
          )
        }
        actions={
          <Button
            size="sm"
            variant={selected.length >= 2 ? 'primary' : 'secondary'}
            disabled={selected.length < 2}
            onClick={() => navigate(`/recruiter/compare?job=1&ids=${selected.join(',')}`)}
          >
            <Columns3 className="h-3.5 w-3.5" /> Compare ({selected.length})
          </Button>
        }
      />

      <Card className="mb-4">
        <form
          className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center"
          onSubmit={(e) => {
            e.preventDefault()
            void run(q)
          }}
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" aria-hidden />
            <Input
              aria-label="Talent search query"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="e.g. Python developers with REST API experience"
              className="h-10 pl-9"
            />
          </div>
          <Button type="submit" variant="primary" className="h-10" loading={loading}>
            <Waves className="h-4 w-4" /> Search talent
          </Button>
        </form>
        <div className="flex flex-wrap items-center gap-1.5 border-t border-line px-3 py-2">
          <span className="text-micro text-faint">Try:</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                setQ(ex)
                void run(ex)
              }}
              className="chip border-line bg-canvas text-muted normal-case tracking-normal transition-colors hover:border-accent/40 hover:text-accent"
            >
              {ex}
            </button>
          ))}
        </div>
      </Card>

      {error && <Card><ErrorState message={error} onRetry={() => run(q)} /></Card>}

      {loading ? (
        <div className="space-y-2.5">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : !result ? (
        <Card>
          <EmptyState
            icon={<Sparkles className="h-4 w-4" />}
            title="Search the talent pool"
            body="Natural-language queries become structured requirements, then semantic matches. Every result carries the resume sentence that justified it."
          />
        </Card>
      ) : result.hits.length === 0 ? (
        <Card>
          <EmptyState title="No candidates matched" body="Try a broader query, for example just the primary skill." />
        </Card>
      ) : (
        <div className="space-y-2.5">
          <Card>
            <CardHeader
              title="Query interpretation"
              subtitle="The requirements the search engine extracted from your sentence"
            />
            <div className="flex flex-wrap gap-1.5 px-4 py-3">
              {result.parsed_requirements.map((r) => (
                <Badge key={r} tone="accent">{r}</Badge>
              ))}
            </div>
          </Card>

          {result.hits.map((c) => (
            <Card key={c.candidate_id} className={cn('p-3 sm:p-4', selected.includes(c.candidate_id) && 'border-accent')}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    aria-label={`Select ${c.name} for comparison`}
                    checked={selected.includes(c.candidate_id)}
                    onChange={() => toggle(c.candidate_id)}
                    className="mt-1 h-4 w-4 border-line bg-canvas accent-[#0043CA]"
                  />
                  <div>
                    <p className="body-copy text-sm font-semibold text-ink">{c.name}</p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-faint">{c.email} · pool candidate</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {c.matched.slice(0, 6).map((m) => <span key={m} className="chip border-good/25 bg-good/8 text-good">{m}</span>)}
                      {c.missing.slice(0, 3).map((m) => <span key={m} className="chip border-line bg-canvas text-muted/80 line-through decoration-faint/60">{m}</span>)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="score-display text-3xl">{Math.round(c.score)}<span className="ml-0.5 font-ui text-xs font-normal text-faint">/100</span></p>
                  <p className="mt-0.5 font-ui text-[10px] uppercase tracking-[0.06em] text-faint">job relevance</p>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {c.evidence.map((e, i) => (
                  <figure key={i} className="border-l-2 border-accent/60 bg-canvas py-1.5 pl-3 pr-2">
                    <blockquote className="body-copy text-xs leading-relaxed text-ink/90">{e.quote}</blockquote>
                    <figcaption className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.06em] text-faint">
                      supports <span className="text-muted">{e.requirement}</span>
                      {typeof e.similarity === 'number' && <span> · {Math.round(e.similarity * 100)}% similarity</span>}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
