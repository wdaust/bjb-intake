import { Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { Login } from './pages/Login'
import { Caseload } from './pages/Caseload'
import { CaseSnapshot } from './pages/CaseSnapshot'
import { GuidedCall } from './pages/GuidedCall'
import { Timeline } from './pages/Timeline'
import { PostCallSummary } from './pages/PostCallSummary'
import { ManagerDashboard } from './pages/ManagerDashboard'
import { TestMode } from './pages/TestMode'
import { FlowBuilder } from './pages/FlowBuilder'
import IntakeQueue from './pages/IntakeQueue'
import IntakeDetail from './pages/IntakeDetail'
import CaseDemoDetail from './pages/CaseDemoDetail'
import Today from './pages/Today'
import { useAuth } from './lib/AuthContext'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  // Dev-only bypass for solo demo rehearsal. Gated on import.meta.env.DEV so it
  // is tree-shaken out of the production bundle. Once `?demo=1` has been seen
  // in this tab we sticky it to sessionStorage so in-app navigation keeps the
  // bypass (React Router drops query strings on navigate()).
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    if (window.location.search.includes('demo=1')) {
      window.sessionStorage.setItem('caos_demo_bypass', '1')
    }
    if (window.sessionStorage.getItem('caos_demo_bypass') === '1') {
      return <>{children}</>
    }
  }
  if (loading) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/" element={<Today />} />
        <Route path="/today" element={<Today />} />
        <Route path="/caseload" element={<Caseload />} />
        <Route path="/intake" element={<IntakeQueue />} />
        <Route path="/intake/:leadId" element={<IntakeDetail />} />
        <Route path="/case-demo/:leadId" element={<CaseDemoDetail />} />
        <Route path="/case/:caseId" element={<CaseSnapshot />} />
        <Route path="/call/:caseId" element={<GuidedCall />} />
        <Route path="/timeline/:caseId" element={<Timeline />} />
        <Route path="/summary/:caseId" element={<PostCallSummary />} />
        <Route path="/manager" element={<ManagerDashboard />} />
        <Route path="/test" element={<TestMode />} />
        <Route path="/builder" element={<FlowBuilder />} />
      </Route>
    </Routes>
  )
}

export default App
