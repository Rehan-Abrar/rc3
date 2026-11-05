import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BriefcaseBusiness, TriangleAlert, UserRound } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { ApiError } from '../../lib/api'
import type { Role } from '../../lib/types'
import { Button, Field, Input } from '../../components/ui/core'
import { cn } from '../../lib/utils'
import { AuthFooter, AuthLayout, AuthSwitch } from './AuthLayout'

const ROLES: Array<{ value: Role; title: string; body: string; icon: typeof BriefcaseBusiness }> = [
  { value: 'recruiter', title: 'Recruiter', body: 'Post jobs, review evidence, schedule interviews', icon: BriefcaseBusiness },
  { value: 'candidate', title: 'Candidate', body: 'Upload a resume, apply, track your status', icon: UserRound },
]

export function RegisterPage() {
  const { register } = useAuth()
  const nav = useNavigate()
  const [role, setRole] = useState<Role>('recruiter')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!fullName.trim()) return setError('Enter your full name.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Enter a valid email address.')
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    if (password !== confirm) return setError('Passwords do not match.')

    setLoading(true)
    try {
      const u = await register({ email: email.trim(), password, full_name: fullName.trim(), role })
      nav(u.role === 'recruiter' ? '/recruiter' : '/candidate', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the account. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout footer={<AuthFooter />}>
      <h2 className="text-2xl font-semibold tracking-tight">Create an account</h2>
      <p className="mt-1 text-sm text-muted">Pick the workspace you need.</p>

      <div className="mt-5 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Account type">
        {ROLES.map((r) => (
          <button
            key={r.value}
            type="button"
            role="radio"
            aria-checked={role === r.value}
            onClick={() => setRole(r.value)}
            className={cn(
              'rounded-lg border p-3 text-left transition-colors',
              role === r.value ? 'border-accent/60 bg-accent/10' : 'border-line bg-surface hover:bg-elevated/60',
            )}
          >
            <r.icon className={cn('h-4 w-4', role === r.value ? 'text-accent' : 'text-faint')} aria-hidden />
            <p className="mt-1.5 text-xs font-semibold text-ink">{r.title}</p>
            <p className="mt-0.5 text-micro leading-snug text-faint">{r.body}</p>
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="mt-5 space-y-3.5" noValidate>
        <Field label="Full name" htmlFor="name">
          <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" placeholder="Nadia Rahman" />
        </Field>
        <Field label="Work email" htmlFor="reg-email">
          <Input id="reg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@company.com" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Password" htmlFor="reg-password" hint="At least 8 characters">
            <Input id="reg-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          </Field>
          <Field label="Confirm password" htmlFor="reg-confirm">
            <Input id="reg-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </Field>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-xs text-bad" role="alert">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Button type="submit" variant="primary" className="w-full" loading={loading}>
          Create {role} account
        </Button>
      </form>

      <AuthSwitch prompt="Already have an account?" to="/login" label="Sign in" />
    </AuthLayout>
  )
}
