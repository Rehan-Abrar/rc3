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
  code: string
}

const RECRUITER_NAV: NavItem[] = [
  { code: '01', to: '/recruiter', label: 'Overview', icon: LayoutDashboard, end: true },
  { code: '02', to: '/recruiter/jobs', label: 'Jobs', icon: BriefcaseBusiness },
  { code: '03', to: '/recruiter/talent', label: 'Talent search', icon: Search },
  { code: '04', to: '/recruiter/interviews', label: 'Interviews', icon: CalendarClock },
  { code: '05', to: '/recruiter/analytics', label: 'Analytics', icon: BarChart3 },
]

const CANDIDATE_NAV: NavItem[] = [
  { code: '01', to: '/candidate', label: 'Overview', icon: LayoutDashboard, end: true },
  { code: '02', to: '/candidate/jobs', label: 'Browse jobs', icon: BriefcaseBusiness },
  { code: '03', to: '/candidate/applications', label: 'My applications', icon: Users },
  { code: '04', to: '/candidate/resume', label: 'My resume', icon: FileText },
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

  const isRecruiter = user?.role === 'recruiter'
  const navItems = isRecruiter ? RECRUITER_NAV : CANDIDATE_NAV
  const title = useMemo(() => TITLES.find(([re]) => re.test(location.pathname))?.[1] ?? 'Match.Wise', [location.pathname])

  const sidebar = (
    <div className="flex h-full w-[236px] shrink-0 flex-col overflow-hidden border-r border-line bg-surface">
      <div className="flex h-16 shrink-0 items-center border-b border-line px-5">
        <NavLink to={isRecruiter ? '/recruiter' : '/candidate'} className="font-display text-[17px] font-medium tracking-tight text-accent">
          Match.Wise
        </NavLink>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3.5 pb-3 pt-5" aria-label="Main">
        <p className="px-2 pb-3.5 font-mono text-[9px] uppercase tracking-[0.14em] text-faint">
          [ {isRecruiter ? 'Recruiter workspace' : 'Candidate portal'} ]
        </p>
        <ul>
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex h-[42px] items-center gap-3 px-3 font-body text-xs transition-colors',
                    isActive
                      ? 'bg-accent font-semibold text-accent-ink'
                      : 'text-ink/75 hover:bg-elevated hover:text-accent',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={cn('w-4 font-mono text-[8px] tracking-[0.08em]', isActive ? 'text-white/60' : 'text-faint')}>
                      {item.code}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="px-2 pt-3.5">
          <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.12em] text-faint">[ AI pipeline ]</p>
          <div className="flex flex-wrap gap-1">
            <Badge tone={health?.ai_mode === 'groq' ? 'good' : 'warn'} dot>
              {health?.ai_mode ?? 'checking'}
            </Badge>
            <Badge tone={health?.embedding_mode === 'dense' ? 'neutral' : 'warn'}>
              {health?.embedding_mode ?? '—'}
            </Badge>
          </div>
          {USE_FIXTURES ? (
            <p className="mt-2 body-copy text-[10px] leading-snug text-faint">
              Demo data. Set <span className="font-mono">VITE_USE_FIXTURES=0</span> to use the live API.
            </p>
          ) : (
            <p className="mt-2 body-copy text-[10px] leading-snug text-faint">Live API · every score is traceable to resume text.</p>
          )}
        </div>
      </nav>

      <div className="relative shrink-0 border-t border-line p-3">
        {menuOpen && <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} aria-hidden />}
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="relative z-30 flex w-full items-center gap-2.5 px-1 py-1 text-left transition-colors hover:bg-canvas"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-elevated font-body text-[11px] font-semibold text-accent">
            {initials(user?.full_name ?? 'U')}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-body text-xs font-medium text-ink">{user?.full_name}</span>
            <span className="block truncate text-[10px] capitalize text-faint">{user?.role}</span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden />
        </button>
        {menuOpen && (
          <div className="absolute bottom-full left-3 right-3 z-30 mb-1 animate-rise-in border border-line bg-surface p-1 shadow-pop" role="menu">
            <div className="px-2.5 py-2">
              <p className="truncate body-copy text-xs font-medium text-ink">{user?.full_name}</p>
              <p className="truncate text-[10px] text-faint">{user?.email}</p>
            </div>
            <div className="divider my-1" />
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-2.5 py-2 body-copy text-xs text-muted transition-colors hover:bg-canvas hover:text-accent"
              onClick={() => {
                logout()
                nav('/login')
              }}
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-canvas">
      <aside className="fixed inset-y-0 left-0 z-20 hidden overflow-hidden lg:block" style={{ height: '100dvh' }}>
        {sidebar}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setMobileOpen(false)} aria-hidden />
          <div className="relative h-screen w-[236px] animate-slide-in" style={{ height: '100dvh' }}>
            {sidebar}
          </div>
        </div>
      )}

      <div className="flex min-h-screen min-w-0 flex-col lg:pl-[236px]">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface/95 px-3 backdrop-blur sm:px-6">
          <button
            type="button"
            className="p-1.5 text-muted hover:bg-elevated hover:text-accent lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
              {isRecruiter ? 'Recruiter' : 'Candidate'} <span className="text-ink/20">/</span>{' '}
              <span className="text-ink/60">{title}</span>
            </p>
          </div>

          {USE_FIXTURES && (
            <Badge tone="warn" dot>
              Fixture data
            </Badge>
          )}

        </header>

        <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 py-6 sm:px-7 sm:py-8">{children}</main>
      </div>
    </div>
  )
}

export function PageHeader({ title, description, actions, meta, eyebrow }: { title: string; description?: string; actions?: ReactNode; meta?: ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="bracket-blue">[ {eyebrow ?? title} ]</p>
        <h2 className="display mt-2 text-[clamp(26px,3.4vw,36px)] leading-[1.1]">{title}</h2>
        {description && <p className="mt-1.5 max-w-2xl body-copy text-sm leading-relaxed text-muted">{description}</p>}
        {meta && <div className="mt-3 flex flex-wrap items-center gap-1.5">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <NavLink to={to} className="mb-2 inline-flex items-center gap-1 body-copy text-xs text-muted transition-colors hover:text-accent">
      <X className="hidden" aria-hidden />
      {children}
    </NavLink>
  )
}
