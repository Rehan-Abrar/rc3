import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Quote, ShieldCheck, Sparkles } from 'lucide-react'

export function AuthLayout({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-canvas">
      <div className="relative hidden w-[46%] flex-col justify-between overflow-hidden border-r border-line bg-surface p-10 lg:flex xl:p-14">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              'radial-gradient(600px circle at 10% 0%, rgb(125 156 255 / 0.18), transparent 60%), radial-gradient(500px circle at 90% 100%, rgb(61 220 151 / 0.10), transparent 60%)',
          }}
        />
        <div className="relative">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-accent-ink">
              <Sparkles className="h-4.5 w-4.5" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold tracking-tight">Hire Intelligence</p>
              <p className="text-micro text-faint">Recruitment &amp; talent intelligence</p>
            </div>
          </div>

          <h1 className="mt-16 max-w-md text-3xl font-semibold leading-tight tracking-tight text-balance">
            Hiring decisions, with receipts.
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
            Every AI score is broken into weighted evidence and tied to a sentence in the resume. Missing
            skills are shown as missing — never as failure.
          </p>

          <div className="mt-8 max-w-md rounded-card border border-line bg-canvas/70 p-4 shadow-panel">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-ink">Django REST Framework</p>
              <span className="chip border-good/30 bg-good/10 text-good">
                <ShieldCheck className="h-3 w-3" /> Matched · 91%
              </span>
            </div>
            <div className="mt-2 border-l-2 border-accent/50 pl-3">
              <p className="text-xs leading-relaxed text-ink/90">
                <Quote className="mr-1 inline h-3 w-3 text-accent/70" aria-hidden />
                Designed and shipped 30+ Django REST endpoints serving 2M requests per day.
              </p>
              <p className="mt-1 text-micro text-faint">Verified against resume text · ayesha-khan-backend.pdf</p>
            </div>
            <div className="mt-3 space-y-1.5">
              {[
                ['Skills', 50, 100],
                ['Experience', 25, 100],
                ['Project relevance', 15, 62],
                ['Qualifications', 10, 100],
              ].map(([label, weight, value]) => (
                <div key={label as string} className="flex items-center gap-2">
                  <span className="w-32 text-micro text-faint">
                    {label} <span className="text-faint/70">{weight}%</span>
                  </span>
                  <span className="h-1 flex-1 overflow-hidden rounded-full bg-elevated">
                    <span className="block h-full rounded-full bg-good" style={{ width: `${value}%` }} />
                  </span>
                  <span className="w-7 text-right text-micro text-muted tnum">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative flex items-center gap-6 text-micro text-faint">
          <span>Semantic matching</span>
          <span>Quote-linked evidence</span>
          <span>Human-in-the-loop</span>
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
          <div className="w-full max-w-[380px]">
            <div className="mb-8 flex items-center gap-2.5 lg:hidden">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-accent-ink">
                <Sparkles className="h-4 w-4" aria-hidden />
              </span>
              <p className="text-sm font-semibold tracking-tight">Hire Intelligence</p>
            </div>
            {children}
          </div>
        </div>
        {footer && <div className="border-t border-line px-4 py-3 text-center text-micro text-faint">{footer}</div>}
      </div>
    </div>
  )
}

export function AuthFooter() {
  return (
    <p>
      Hackathon build · seeded demo accounts, one click to fill
    </p>
  )
}

export function AuthSwitch({ prompt, to, label }: { prompt: string; to: string; label: string }) {
  return (
    <p className="mt-4 text-center text-xs text-muted">
      {prompt}{' '}
      <Link to={to} className="link font-medium">
        {label}
      </Link>
    </p>
  )
}
