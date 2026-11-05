import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { AuthProvider, useAuth } from './lib/auth'
import { ToastProvider } from './components/ui/toast'
import { AppShell } from './components/layout/AppShell'
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/auth/LoginPage'
import { RegisterPage } from './pages/auth/RegisterPage'
import { RecruiterDashboardPage } from './pages/recruiter/DashboardPage'
import { JobsPage } from './pages/recruiter/JobsPage'
import { JobEditorPage } from './pages/recruiter/JobEditorPage'
import { JobDetailPage } from './pages/recruiter/JobDetailPage'
import { ApplicantsPage } from './pages/recruiter/ApplicantsPage'
import { ApplicationDetailPage } from './pages/recruiter/ApplicationDetailPage'
import { InterviewsPage } from './pages/recruiter/InterviewsPage'
import { AnalyticsPage } from './pages/recruiter/AnalyticsPage'
import { TalentSearchPage } from './pages/recruiter/TalentSearchPage'
import { ComparePage } from './pages/recruiter/ComparePage'
import { CandidateDashboardPage } from './pages/candidate/DashboardPage'
import { JobsBrowsePage } from './pages/candidate/JobsBrowsePage'
import { MyApplicationsPage } from './pages/candidate/MyApplicationsPage'
import { ResumePage } from './pages/candidate/ResumePage'

function RedirectByRole() {
  const { user, loading } = useAuth()
  if (loading) return <Splash />
  if (!user) return <LandingPage />
  return <Navigate to={user.role === 'recruiter' ? '/recruiter' : '/candidate'} replace />
}

function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <Loader2 className="h-5 w-5 animate-spin text-accent" aria-label="Loading" />
    </div>
  )
}

function RequireRole({ role, children }: { role: 'recruiter' | 'candidate'; children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Splash />
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  if (user.role !== role) return <Navigate to={user.role === 'recruiter' ? '/recruiter' : '/candidate'} replace />
  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route
            path="/recruiter"
            element={
              <RequireRole role="recruiter">
                <AppShell><RecruiterDashboardPage /></AppShell>
              </RequireRole>
            }
          />
          <Route
            path="/recruiter/jobs"
            element={
              <RequireRole role="recruiter">
                <AppShell><JobsPage /></AppShell>
              </RequireRole>
            }
          />
          <Route
            path="/recruiter/jobs/new"
            element={
              <RequireRole role="recruiter">
                <AppShell><JobEditorPage /></AppShell>
              </RequireRole>
            }
          />
          <Route
            path="/recruiter/jobs/:id/edit"
            element={
              <RequireRole role="recruiter">
                <AppShell><JobEditorPage /></AppShell>
              </RequireRole>
            }
          />
          <Route
            path="/recruiter/jobs/:id/applicants"
            element={
              <RequireRole role="recruiter">
                <AppShell><ApplicantsPage /></AppShell>
              </RequireRole>
            }
          />
          <Route
            path="/recruiter/jobs/:id"
            element={
              <RequireRole role="recruiter">
                <AppShell><JobDetailPage /></AppShell>
              </RequireRole>
            }
          />
          <Route
            path="/recruiter/applications/:id"
            element={
              <RequireRole role="recruiter">
                <AppShell><ApplicationDetailPage /></AppShell>
              </RequireRole>
            }
          />
          <Route
            path="/recruiter/talent"
            element={
              <RequireRole role="recruiter">
                <AppShell><TalentSearchPage /></AppShell>
              </RequireRole>
            }
          />
          <Route
            path="/recruiter/compare"
            element={
              <RequireRole role="recruiter">
                <AppShell><ComparePage /></AppShell>
              </RequireRole>
            }
          />
          <Route
            path="/recruiter/interviews"
            element={
              <RequireRole role="recruiter">
                <AppShell><InterviewsPage /></AppShell>
              </RequireRole>
            }
          />
          <Route
            path="/recruiter/analytics"
            element={
              <RequireRole role="recruiter">
                <AppShell><AnalyticsPage /></AppShell>
              </RequireRole>
            }
          />

          <Route
            path="/candidate"
            element={
              <RequireRole role="candidate">
                <AppShell><CandidateDashboardPage /></AppShell>
              </RequireRole>
            }
          />
          <Route
            path="/candidate/jobs"
            element={
              <RequireRole role="candidate">
                <AppShell><JobsBrowsePage /></AppShell>
              </RequireRole>
            }
          />
          <Route
            path="/candidate/applications"
            element={
              <RequireRole role="candidate">
                <AppShell><MyApplicationsPage /></AppShell>
              </RequireRole>
            }
          />
          <Route
            path="/candidate/resume"
            element={
              <RequireRole role="candidate">
                <AppShell><ResumePage /></AppShell>
              </RequireRole>
            }
          />

          <Route path="/" element={<RedirectByRole />} />
          <Route path="*" element={<RedirectByRole />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  )
}
