import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getManagerStats, type ManagerStats } from '@/data/liveData'

const SEVERITY_COLORS = {
  low: 'bg-blue-100 text-blue-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
}

export function ManagerDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<ManagerStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedQueue, setSelectedQueue] = useState<string | null>(null)

  useEffect(() => {
    getManagerStats().then(s => {
      setStats(s)
      setLoading(false)
    })
  }, [])

  if (loading || !stats) return <p className="text-muted-foreground">Loading dashboard (querying all cases)...</p>

  const queues = [
    { id: 'stagnation', label: 'Treatment Stagnation', description: 'Cases with 14+ day treatment gap', count: stats.treatmentGapCount, severity: 'critical' as const },
    { id: 'no_appointment', label: 'No Recent Treatment', description: 'No treatment activity in 30+ days', count: stats.noAppointmentCount, severity: 'high' as const },
    { id: 'barrier', label: 'Unresolved Referrals', description: 'Open referral-related tasks', count: stats.unresolvedReferralCount, severity: 'high' as const },
    { id: 'weak', label: 'Weak Case Development', description: 'Open 90+ days with <3 treatment records', count: stats.weakCaseCount, severity: 'critical' as const },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Manager Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Full portfolio overview — {stats.totalCases.toLocaleString()} open PI cases
        </p>
      </div>

      {/* Top-Level Metrics */}
      <div className="grid grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{stats.totalCases.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Open Cases</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.withNextAppt.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Active (Recent Treatment)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-orange-600">{stats.stagnating.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Stagnating (14d+ Gap)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{stats.highRisk.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">High Risk (30d+ Gap)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{stats.weakCaseCount.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Weak Development</p>
          </CardContent>
        </Card>
      </div>

      {/* Queues Grid */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Review Queues</h2>
        <div className="grid grid-cols-4 gap-3">
          {queues.map((q) => (
            <Card
              key={q.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedQueue === q.id ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => setSelectedQueue(selectedQueue === q.id ? null : q.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${SEVERITY_COLORS[q.severity]}`}>
                    {q.severity}
                  </span>
                  <span className="text-2xl font-bold">{q.count.toLocaleString()}</span>
                </div>
                <p className="text-sm font-medium">{q.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{q.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Stagnation Drill-Down */}
      {selectedQueue === 'stagnation' && stats.stagnationCases.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top Stagnating Cases (worst first)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.stagnationCases.map((c) => (
                <div
                  key={c.sf_id}
                  className="flex items-center justify-between rounded border p-3 cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/case/${c.sf_id}`)}
                >
                  <div>
                    <p className="font-medium text-sm">{c.client_name}</p>
                    <p className="text-xs text-muted-foreground">{c.display_name}</p>
                  </div>
                  <Badge variant="destructive">{c.gap_days}d gap</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* CM Performance Metrics */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Case Manager Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Calls This Week</p>
              <p className="text-xl font-bold">12</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Contact Rate</p>
              <p className="text-xl font-bold">75%</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Next-Step Secured</p>
              <p className="text-xl font-bold">83%</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Barrier Capture Rate</p>
              <p className="text-xl font-bold">91%</p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4 text-sm mt-4">
            <div>
              <p className="text-muted-foreground text-xs">Field Completion Rate</p>
              <p className="text-xl font-bold">94%</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Re-Engagement Success</p>
              <p className="text-xl font-bold">67%</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Avg Call Duration</p>
              <p className="text-xl font-bold">8m</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Prompt Adherence</p>
              <p className="text-xl font-bold">88%</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
