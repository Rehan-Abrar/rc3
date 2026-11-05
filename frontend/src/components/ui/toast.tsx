import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'
import { cn } from '../../lib/utils'

type ToastTone = 'success' | 'error' | 'info'
interface ToastItem {
  id: number
  message: string
  tone: ToastTone
}

const ToastContext = createContext<{ push: (message: string, tone?: ToastTone) => void } | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const push = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = Date.now() + Math.random()
    setItems((prev) => [...prev, { id, message, tone }])
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4800)
  }, [])

  const value = useMemo(() => ({ push }), [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2"
        role="status"
        aria-live="polite"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm shadow-pop animate-rise-in',
              t.tone === 'success' && 'border-good/30 bg-[rgb(20,32,28)] text-ink',
              t.tone === 'error' && 'border-bad/40 bg-[rgb(36,20,24)] text-ink',
              t.tone === 'info' && 'border-line bg-elevated text-ink',
            )}
          >
            <span className="mt-0.5 shrink-0">
              {t.tone === 'success' ? (
                <CheckCircle2 className="h-4 w-4 text-good" />
              ) : t.tone === 'error' ? (
                <TriangleAlert className="h-4 w-4 text-bad" />
              ) : (
                <Info className="h-4 w-4 text-accent" />
              )}
            </span>
            <p className="flex-1 leading-snug">{t.message}</p>
            <button
              type="button"
              aria-label="Dismiss notification"
              className="mt-0.5 rounded p-0.5 text-faint transition-colors hover:text-ink"
              onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
