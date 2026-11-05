import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck, Sparkles, Quote } from 'lucide-react'

export function AuthLayout({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-surface">
      <div className="relative hidden w-[48%] flex-col justify-between overflow-hidden bg-accent p-10 text-accent-ink lg:flex xl:p-14">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
          }}
        />
        <div className="relative">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center border border-white/40 text-accent-ink">
              <Sparkles className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <p className="font-display text-[15px] font-medium tracking-tight">Hire Intelligence</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-white/60">Recruitment &amp; talent intelligence</p>
            </div>
          </div>

          <p className="mt-14 font-mono text-[11px] uppercase tracking-[0.12em] text-white/70">[ Evidence-first hiring ]</p>
          <h1 className="mt-3 max-w-lg font-display text-[clamp(34px,4.2vw,52px)] font-light leading-[1.05] tracking-[-0.02em] text-white text-balance">
            Hiring decisions, with receipts.
          </h1>
          <p className="mt-4 max-w-md body-copy text-[15px] leading-relaxed text-white/75">
            Every AI score is broken into weighted evidence and tied to a sentence in the resume. Missing skills are shown
            as missing — never as failure.
          </p>

          <div className="mt-9 max-w-md border border-white/25 bg-white p-4 text-ink">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-body text-xs font-semibold text-ink">Django REST Framework</p>
              <span className="inline-flex items-center gap-1 border border-good/25 bg-good/8 px-1.5 py-0.5 font-ui text-[10px] font-medium uppercase tracking-[0.06em] text-good">
                <ShieldCheck className="h-3 w-3" /> Matched · 91%
              </span>
            </div>
            <div className="mt-2 border-l-2 border-accent bg-canvas py-2 pl-3 pr-2">
              <p className="body-copy text-xs leading-relaxed text-ink/90">
                <Quote className="mr-1 inline h-3 w-3 text-accent" aria-hidden />
                Designed and shipped 30+ Django REST endpoints serving 2M requests per day.
              </p>
              <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.08em] text-faint">
                Verified against resume text · ayesha-khan-backend.pdf
              </p>
            </div>
            <div className="mt-3 space-y-1.5">
              {[
                ['Skills', 50, 100],
                ['Experience', 25, 100],
                ['Project relevance', 15, 62],
                ['Qualifications', 10, 100],
              ].map(([label, weight, value]) => (
                <div key={label as string} className="flex items-center gap-2">
                  <span className="w-32 font-body text-[11px] text-muted">
                    {label} <span className="text-faint">{weight}%</span>
                  </span>
                  <span className="h-1 flex-1 overflow-hidden bg-elevated">
                    <span className="block h-full bg-accent" style={{ width: `${value}%` }} />
                  </span>
                  <span className="w-7 text-right font-ui text-[10px] text-muted tnum">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative flex flex-wrap items-center gap-x-6 gap-y-1 font-mono text-[10px] uppercase tracking-[0.1em] text-white/55">
          <span>Semantic matching</span>
          <span>Quote-linked evidence</span>
          <span>Human-in-the-loop</span>
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
          <div className="w-full max-w-[400px]">
            <div className="mb-8 flex items-center gap-2.5 lg:hidden">
              <span className="flex h-7 w-7 items-center justify-center bg-accent text-accent-ink">
                <Sparkles className="h-4 w-4" aria-hidden />
              </span>
              <p className="font-display text-[15px] font-medium tracking-tight text-accent">Hire Intelligence</p>
            </div>
            {children}
          </div>
        </div>
        {footer && <div className="border-t border-line px-4 py-3 text-center font-mono text-[10px] uppercase tracking-[0.08em] text-faint">{footer}</div>}
      </div>
    </div>
  )
}

export function AuthFooter() {
  return <p>Hackathon build · seeded demo accounts, one click to fill</p>
}

export function AuthSwitch({ prompt, to, label }: { prompt: string; to: string; label: string }) {
  return (
    <p className="mt-5 text-center body-copy text-xs text-muted">
      {prompt}{' '}
      <Link to={to} className="link font-medium">
        {label}
      </Link>
    </p>
  )
}
