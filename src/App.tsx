import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { Caseload } from './pages/Caseload'
import { CaseSnapshot } from './pages/CaseSnapshot'
import { GuidedCall } from './pages/GuidedCall'
import { Timeline } from './pages/Timeline'
import { PostCallSummary } from './pages/PostCallSummary'
import { ManagerDashboard } from './pages/ManagerDashboard'

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Caseload />} />
        <Route path="/case/:caseId" element={<CaseSnapshot />} />
        <Route path="/call/:caseId" element={<GuidedCall />} />
        <Route path="/timeline/:caseId" element={<Timeline />} />
        <Route path="/summary/:caseId" element={<PostCallSummary />} />
        <Route path="/manager" element={<ManagerDashboard />} />
      </Route>
    </Routes>
  )
}

export default App
