import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogIn, TriangleAlert } from 'lucide-react'
import { useAuth } from '../../lib/auth'
import { ApiError, DEMO_ACCOUNTS } from '../../lib/api'
import { Button, Field, Input } from '../../components/ui/core'
import { AuthFooter, AuthLayout, AuthSwitch } from './AuthLayout'

const DEMOS = [
  { role: 'Recruiter', email: DEMO_ACCOUNTS.recruiter.email, password: DEMO_ACCOUNTS.recruiter.password, name: 'Nadia Rahman' },
  { role: 'Candidate', email: DEMO_ACCOUNTS.candidate.email, password: DEMO_ACCOUNTS.candidate.password, name: 'Ayesha Khan' },
]

export function LoginPage() {
  const { user, login } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) nav(user.role === 'recruiter' ? '/recruiter' : '/candidate', { replace: true })
  }, [user, nav])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!email.trim() || !password) {
      setError('Enter your email and password.')
      return
    }
    setLoading(true)
    try {
      const u = await login(email.trim(), password)
      nav(u.role === 'recruiter' ? '/recruiter' : '/candidate', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const useDemo = (demo: (typeof DEMOS)[number]) => {
    setEmail(demo.email)
    setPassword(demo.password)
    setError(null)
  }

  return (
    <AuthLayout footer={<AuthFooter />}>
      <p className="bracket-blue">[ Sign in ]</p>
      <h2 className="display mt-2 text-[32px] leading-[1.1]">Welcome back.</h2>
      <p className="mt-1.5 body-copy text-sm text-muted">Continue to your hiring workspace.</p>

      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <Field label="Work email" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        <Field label="Password" htmlFor="password">
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>

        {error && (
          <div className="flex items-start gap-2 border border-bad/30 bg-bad/5 px-3 py-2 body-copy text-xs text-bad" role="alert">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Button type="submit" variant="primary" className="w-full" loading={loading}>
          <LogIn className="h-4 w-4" /> Sign in
        </Button>
      </form>

      <div className="mt-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">[ Demo accounts ]</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {DEMOS.map((d) => (
              <button
                key={d.email}
                type="button"
                onClick={() => useDemo(d)}
                className="border border-line bg-surface px-3 py-2 text-left transition-colors hover:border-accent/40 hover:bg-canvas"
              >
                <p className="font-ui text-[10px] font-medium uppercase tracking-[0.08em] text-accent">{d.role}</p>
                <p className="mt-0.5 truncate body-copy text-[11px] text-muted">{d.email}</p>
              </button>
            ))}
          </div>
        <p className="mt-2 body-copy text-[11px] leading-snug text-faint">
          Seeded accounts — click a card to fill the form, then sign in.
        </p>
      </div>

      <AuthSwitch prompt="New here?" to="/register" label="Create an account" />
    </AuthLayout>
  )
}
