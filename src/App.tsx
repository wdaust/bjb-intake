import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { Home } from './pages/Home'
import { Intake } from './pages/Intake'
import { AdminScripts } from './pages/AdminScripts'
import { AdminSessions } from './pages/AdminSessions'

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/intake/:sessionId" element={<Intake />} />
        <Route path="/admin/scripts" element={<AdminScripts />} />
        <Route path="/admin/sessions" element={<AdminSessions />} />
      </Route>
    </Routes>
  )
}

export default App
