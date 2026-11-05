import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  BriefcaseBusiness,
  CalendarClock,
  ChevronDown,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Sparkles,
  Users,
  X,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useAuth } from '../../lib/auth'
import { USE_FIXTURES, opsApi } from '../../lib/api'
import type { Health } from '../../lib/types'
import { cn, initials } from '../../lib/utils'
import { Badge } from '../ui/core'

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  end?: boolean
}

const RECRUITER_NAV: NavItem[] = [
  { to: '/recruiter', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/recruiter/jobs', label: 'Jobs', icon: BriefcaseBusiness },
  { to: '/recruiter/talent', label: 'Talent search', icon: Search },
  { to: '/recruiter/interviews', label: 'Interviews', icon: CalendarClock },
  { to: '/recruiter/analytics', label: 'Analytics', icon: BarChart3 },
]

const CANDIDATE_NAV: NavItem[] = [
  { to: '/candidate', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/candidate/jobs', label: 'Browse jobs', icon: BriefcaseBusiness },
  { to: '/candidate/applications', label: 'My applications', icon: Users },
  { to: '/candidate/resume', label: 'My resume', icon: FileText },
]

const TITLES: Array<[RegExp, string]> = [
  [/^\/recruiter$/, 'Overview'],
  [/^\/recruiter\/jobs\/new$/, 'New job'],
  [/^\/recruiter\/jobs\/\d+\/applicants$/, 'Applicants'],
  [/^\/recruiter\/jobs\/\d+\/edit$/, 'Edit job'],
  [/^\/recruiter\/jobs\/\d+$/, 'Job detail'],
  [/^\/recruiter\/jobs$/, 'Jobs'],
  [/^\/recruiter\/applications\/\d+$/, 'Application'],
  [/^\/recruiter\/talent$/, 'Talent search'],
  [/^\/recruiter\/compare$/, 'Compare candidates'],
  [/^\/recruiter\/interviews$/, 'Interviews'],
  [/^\/recruiter\/analytics$/, 'Analytics'],
  [/^\/candidate$/, 'Overview'],
  [/^\/candidate\/jobs$/, 'Browse jobs'],
  [/^\/candidate\/applications$/, 'My applications'],
  [/^\/candidate\/resume$/, 'My resume'],
]

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [health, setHealth] = useState<Health | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    opsApi.health().then(setHealth).catch(() => setHealth(null))
  }, [])

  useEffect(() => {
    setMobileOpen(false)
    setMenuOpen(false)
  }, [location.pathname])

  const navItems = user?.role === 'recruiter' ? RECRUITER_NAV : CANDIDATE_NAV
  const title = useMemo(() => TITLES.find(([re]) => re.test(location.pathname))?.[1] ?? 'Hire Intelligence', [location.pathname])

  const sidebar = (
    <div className="flex h-full w-60 shrink-0 flex-col border-r border-line bg-surface">
      <div className="flex h-14 items-center gap-2.5 border-b border-line px-4">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-accent-ink">
          <Sparkles className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight">Hire Intelligence</p>
          <p className="text-micro text-faint">Evidence-first hiring</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-2.5" aria-label="Main">
        <p className="px-2 pb-1.5 pt-2 text-micro font-medium uppercase tracking-wider text-faint">
          {user?.role === 'recruiter' ? 'Recruiting' : 'Candidate'}
        </p>
        <ul className="space-y-0.5">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
                    isActive ? 'bg-elevated font-medium text-ink' : 'text-muted hover:bg-elevated/60 hover:text-ink',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon className={cn('h-4 w-4', isActive ? 'text-accent' : 'text-faint')} aria-hidden />
                    <span className="truncate">{item.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-line p-2.5">
        <div className="rounded-md border border-line bg-canvas/60 px-2.5 py-2">
          <p className="text-micro font-medium text-muted">AI pipeline</p>
          <div className="mt-1 flex flex-wrap gap-1">
            <Badge tone={health?.ai_mode === 'groq' ? 'good' : 'warn'} dot>
              {health?.ai_mode ?? 'checking'}
            </Badge>
            <Badge tone={health?.embedding_mode === 'dense' ? 'neutral' : 'warn'}>
              {health?.embedding_mode ?? '—'}
            </Badge>
          </div>
          {USE_FIXTURES && (
            <p className="mt-1.5 text-micro leading-snug text-faint">
              Demo data. Switch with <span className="font-mono">VITE_USE_FIXTURES=0</span> for the live API.
            </p>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen bg-canvas">
      <aside className="hidden lg:block">{sidebar}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} aria-hidden />
          <div className="relative h-full animate-slide-in">{sidebar}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-canvas/85 px-3 backdrop-blur sm:px-5">
          <button
            type="button"
            className="rounded-md p-1.5 text-muted hover:bg-elevated hover:text-ink lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold tracking-tight text-ink">{title}</h1>
          </div>

          <div className="hidden items-center gap-1.5 sm:flex">
            <Badge tone="neutral" className="hidden md:inline-flex">
              {user?.role === 'recruiter' ? 'Recruiter console' : 'Candidate portal'}
            </Badge>
            {USE_FIXTURES && (
              <Badge tone="warn" dot className="hidden md:inline-flex">
                Fixture data
              </Badge>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-elevated"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-line bg-elevated text-micro font-semibold text-muted">
                {initials(user?.full_name ?? 'U')}
              </span>
              <span className="hidden min-w-0 sm:block">
                <span className="block max-w-[140px] truncate text-xs font-medium text-ink">{user?.full_name}</span>
                <span className="block text-micro capitalize text-faint">{user?.role}</span>
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-faint" aria-hidden />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden />
                <div className="absolute right-0 z-20 mt-1.5 w-52 animate-rise-in rounded-lg border border-line bg-surface p-1 shadow-pop" role="menu">
                  <div className="px-2.5 py-2">
                    <p className="truncate text-xs font-medium text-ink">{user?.full_name}</p>
                    <p className="truncate text-micro text-faint">{user?.email}</p>
                  </div>
                  <div className="divider my-1" />
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs text-muted transition-colors hover:bg-elevated hover:text-ink"
                    onClick={() => {
                      logout()
                      nav('/login')
                    }}
                  >
                    <LogOut className="h-3.5 w-3.5" /> Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-3 py-4 sm:px-5 sm:py-5">{children}</main>
      </div>
    </div>
  )
}

export function PageHeader({ title, description, actions, meta }: { title: string; description?: string; actions?: ReactNode; meta?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-xl font-semibold tracking-tight text-ink">{title}</h2>
        {description && <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-muted">{description}</p>}
        {meta && <div className="mt-2 flex flex-wrap items-center gap-1.5">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <NavLink to={to} className="mb-2 inline-flex items-center gap-1 text-xs text-muted transition-colors hover:text-ink">
      <X className="hidden" aria-hidden />
      {children}
    </NavLink>
  )
}
