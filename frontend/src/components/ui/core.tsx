import { useEffect, useId, useRef } from 'react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { Loader2, X } from 'lucide-react'
import { cn, initials, type Tone } from '../../lib/utils'

/* ---------------------------------- Button --------------------------------- */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle'
type Size = 'sm' | 'md'

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:brightness-110 active:brightness-95 shadow-sm',
  secondary: 'border border-line bg-elevated text-ink hover:border-faint/70 hover:bg-elevated/80',
  ghost: 'text-muted hover:bg-elevated hover:text-ink',
  danger: 'border border-bad/40 bg-bad/10 text-bad hover:bg-bad/20',
  subtle: 'bg-elevated/60 text-ink hover:bg-elevated',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center gap-1.5 rounded-lg font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-9 px-3.5 text-sm',
        variants[variant],
        className,
      )}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}

/* ---------------------------------- Badge ---------------------------------- */

const tones: Record<Tone, string> = {
  neutral: 'border-line bg-elevated/60 text-muted',
  accent: 'border-accent/30 bg-accent/10 text-accent',
  good: 'border-good/30 bg-good/10 text-good',
  warn: 'border-warn/30 bg-warn/10 text-warn',
  bad: 'border-bad/30 bg-bad/10 text-bad',
}

export function Badge({
  tone = 'neutral',
  children,
  className,
  dot,
}: {
  tone?: Tone
  children: ReactNode
  className?: string
  dot?: boolean
}) {
  return (
    <span className={cn('chip', tones[tone], className)}>
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', tone === 'good' ? 'bg-good' : tone === 'warn' ? 'bg-warn' : tone === 'bad' ? 'bg-bad' : tone === 'accent' ? 'bg-accent' : 'bg-faint')} />}
      {children}
    </span>
  )
}

/* ----------------------------------- Card ---------------------------------- */

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('panel', className)}>{children}</section>
}

export function CardHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="panel-header">
      <div className="min-w-0">
        <h2 className="text-base font-semibold tracking-tight text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}

/* ---------------------------------- Fields --------------------------------- */

export function Field({ label, htmlFor, hint, error, children, required }: { label: string; htmlFor?: string; hint?: string; error?: string | null; children: ReactNode; required?: boolean }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="label">
        {label}
        {required && <span className="ml-1 text-bad">*</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-bad" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-faint">{hint}</p>
      ) : null}
    </div>
  )
}

export const Input = ({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) => (
  <input {...props} className={cn('field h-9', className)} />
)

export const Textarea = ({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...props} className={cn('field min-h-[96px] resize-y', className)} />
)

export const Select = ({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...props} className={cn('field h-9 pr-8', className)}>
    {children}
  </select>
)

/* ---------------------------------- Tabs ----------------------------------- */

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: Array<{ value: T; label: string; count?: number }>; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg border border-line bg-canvas/60 p-1" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            'rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
            value === t.value ? 'bg-elevated text-ink shadow-sm' : 'text-muted hover:text-ink',
          )}
        >
          {t.label}
          {typeof t.count === 'number' && <span className="ml-1.5 text-faint">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

/* --------------------------------- Dialog ---------------------------------- */

export function Dialog({ open, onClose, title, description, children, footer, width = 'max-w-lg' }: { open: boolean; onClose: () => void; title: string; description?: string; children?: ReactNode; footer?: ReactNode; width?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    setTimeout(() => ref.current?.querySelector<HTMLElement>('input,textarea,select,button')?.focus(), 30)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-[2px] sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn('w-full animate-rise-in rounded-t-xl border border-line bg-surface shadow-pop sm:rounded-xl', width)}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-ink">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="rounded-md p-1 text-faint transition-colors hover:bg-elevated hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children && <div className="max-h-[70vh] overflow-y-auto px-4 py-4">{children}</div>}
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-4 py-3">{footer}</div>}
      </div>
    </div>
  )
}

/* -------------------------------- Feedback --------------------------------- */

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {icon && <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full border border-line bg-elevated text-faint">{icon}</div>}
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {body && <p className="max-w-sm text-xs leading-relaxed text-muted">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-elevated/80', className)} />
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <p className="max-w-md text-sm text-muted">{message}</p>
      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

/* ---------------------------------- Misc ----------------------------------- */

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full border border-line bg-elevated font-semibold text-muted"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {initials(name)}
    </span>
  )
}

export function StatCard({ label, value, hint, icon, tone = 'neutral' }: { label: string; value: ReactNode; hint?: string; icon?: ReactNode; tone?: Tone }) {
  const toneText = tone === 'good' ? 'text-good' : tone === 'warn' ? 'text-warn' : tone === 'bad' ? 'text-bad' : tone === 'accent' ? 'text-accent' : 'text-ink'
  return (
    <div className="panel px-4 py-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted">{label}</p>
        {icon && <span className="text-faint">{icon}</span>}
      </div>
      <p className={cn('mt-1 text-2xl font-semibold tracking-tight tnum', toneText)}>{value}</p>
      {hint && <p className="mt-0.5 text-micro text-faint">{hint}</p>}
    </div>
  )
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn('h-px w-full bg-line', className)} />
}
