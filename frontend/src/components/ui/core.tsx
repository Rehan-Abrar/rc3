import { useEffect, useId, useRef } from 'react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { Loader2, X } from 'lucide-react'
import { cn, initials, type Tone } from '../../lib/utils'

/* ---------------------------------- Button --------------------------------- */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle'
type Size = 'sm' | 'md'

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:bg-accent/88 active:bg-accent',
  secondary: 'border border-ink/15 bg-surface text-ink hover:border-ink/30 hover:bg-canvas',
  ghost: 'text-muted hover:bg-elevated hover:text-accent',
  danger: 'border border-bad/30 bg-bad/5 text-bad hover:bg-bad/10',
  subtle: 'bg-elevated text-accent hover:bg-accent/12',
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
        'inline-flex select-none items-center justify-center gap-1.5 rounded-none font-body text-sm font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45',
        size === 'sm' ? 'h-8 px-3 text-xs' : 'h-10 px-4',
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
  neutral: 'border-line bg-canvas text-muted',
  accent: 'border-accent/25 bg-accent/8 text-accent',
  good: 'border-good/25 bg-good/8 text-good',
  warn: 'border-warn/25 bg-warn/8 text-warn',
  bad: 'border-bad/30 bg-bad/8 text-bad',
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
      {dot && (
        <span
          className={cn(
            'h-1 w-1',
            tone === 'good' ? 'bg-good' : tone === 'warn' ? 'bg-warn' : tone === 'bad' ? 'bg-bad' : tone === 'accent' ? 'bg-accent' : 'bg-faint',
          )}
        />
      )}
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
        <h2 className="font-display text-[15px] font-medium leading-tight text-ink">{title}</h2>
        {subtitle && <p className="mt-1 body-copy text-xs text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">{actions}</div>}
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
        <p className="mt-1 body-copy text-xs text-bad" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 body-copy text-xs text-faint">{hint}</p>
      ) : null}
    </div>
  )
}

export const Input = ({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) => (
  <input {...props} className={cn('field h-10', className)} />
)

export const Textarea = ({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...props} className={cn('field min-h-[96px] resize-y body-copy', className)} />
)

export const Select = ({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...props} className={cn('field h-10 pr-8', className)}>
    {children}
  </select>
)

/* ---------------------------------- Tabs ----------------------------------- */

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: Array<{ value: T; label: string; count?: number }>; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap items-stretch border border-line bg-surface" role="tablist">
      {tabs.map((t, i) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            'px-3 py-2 font-body text-xs font-medium transition-colors',
            i > 0 && 'border-l border-line',
            value === t.value ? 'bg-accent text-accent-ink' : 'text-muted hover:bg-canvas hover:text-ink',
          )}
        >
          {t.label}
          {typeof t.count === 'number' && (
            <span className={cn('ml-1.5 tnum', value === t.value ? 'text-white/70' : 'text-faint')}>{t.count}</span>
          )}
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/35 p-0 sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn('w-full animate-rise-in border border-line bg-surface shadow-pop', width)}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3">
          <div>
            <h2 id={titleId} className="font-display text-[15px] font-medium text-ink">
              {title}
            </h2>
            {description && <p className="mt-1 body-copy text-xs text-muted">{description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="p-1 text-faint transition-colors hover:bg-canvas hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children && <div className="max-h-[70vh] overflow-y-auto px-4 py-4">{children}</div>}
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-canvas/60 px-4 py-3">{footer}</div>}
      </div>
    </div>
  )
}

/* -------------------------------- Feedback --------------------------------- */

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {icon && <div className="mb-1 flex h-10 w-10 items-center justify-center border border-line bg-canvas text-faint">{icon}</div>}
      <h3 className="font-display text-sm font-medium text-ink">{title}</h3>
      {body && <p className="max-w-sm body-copy text-xs leading-relaxed text-muted">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-none bg-elevated', className)} />
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <p className="max-w-md body-copy text-sm text-muted">{message}</p>
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
      className="inline-flex shrink-0 items-center justify-center rounded-none bg-elevated font-body font-semibold text-accent"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {initials(name)}
    </span>
  )
}

export function StatCard({ label, value, hint, icon, tone = 'neutral', index }: { label: string; value: ReactNode; hint?: string; icon?: ReactNode; tone?: Tone; index?: string }) {
  const toneText = tone === 'good' ? 'text-good' : tone === 'warn' ? 'text-warn' : tone === 'bad' ? 'text-bad' : 'text-ink'
  return (
    <div className="panel px-4 py-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-faint">
          {index && <span className="mr-1.5 text-ink/25">{index}</span>}
          {label}
        </p>
        {icon && <span className="text-faint">{icon}</span>}
      </div>
      <p className={cn('mt-1.5 font-display text-[30px] font-light leading-none tracking-tight tnum', toneText)}>{value}</p>
      {hint && <p className="mt-1.5 body-copy text-[11px] leading-snug text-muted">{hint}</p>}
    </div>
  )
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn('h-px w-full bg-line', className)} />
}
