import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getAllCasesLive } from '@/data/liveData'
import type { FullCaseView } from '@/types'

type QueueName = 'stagnation' | 'no_appointment' | 'barrier' | 'demand' | 'litigation' | 'cut' | 'transfer' | 'unresolved'

interface QueueDef {
  id: QueueName
  label: string
  description: string
  filter: (cv: FullCaseView) => boolean
  severity: 'low' | 'medium' | 'high' | 'critical'
}

const QUEUES: QueueDef[] = [
  {
    id: 'stagnation',
    label: 'Treatment Stagnation',
    description: 'Cases with significant treatment gaps or declining continuity',
    filter: (cv) => cv.operational.treatmentGapDays > 14 || cv.scores.treatmentContinuityScore < 30,
    severity: 'critical',
  },
  {
    id: 'no_appointment',
    label: 'No Next Appointment',
    description: 'Cases with no scheduled next appointment',
    filter: (cv) => !cv.treatment.nextAppointmentDate,
    severity: 'high',
  },
  {
    id: 'barrier',
    label: 'Unresolved Barriers',
    description: 'Cases with high barrier severity or unresolved referrals',
    filter: (cv) => cv.scores.barrierSeverityScore > 50 || cv.operational.unresolvedReferralDays > 14,
    severity: 'high',
  },
  {
    id: 'demand',
    label: 'Demand-Readiness Candidates',
    description: 'Cases potentially approaching demand readiness',
    filter: (cv) => cv.scores.demandTrajectoryScore > 65,
    severity: 'medium',
  },
  {
    id: 'litigation',
    label: 'Litigation Review Candidates',
    description: 'Cases that may need litigation review',
    filter: (cv) => cv.scores.symptomPersistenceScore > 70 && cv.scores.treatmentContinuityScore < 40,
    severity: 'medium',
  },
  {
    id: 'cut',
    label: 'Cut Review Candidates',
    description: 'Cases with weak development that may need cut review',
    filter: (cv) => cv.scores.caseWeaknessScore > 65,
    severity: 'critical',
  },
  {
    id: 'transfer',
    label: 'Transfer Review Candidates',
    description: 'Cases with transfer considerations',
    filter: (cv) => !!cv.caseData.transferRiskNote,
    severity: 'medium',
  },
  {
    id: 'unresolved',
    label: 'Unresolved Direction',
    description: 'Cases where direction is unclear',
    filter: (cv) => cv.scores.directionConfidenceScore < 35,
    severity: 'high',
  },
]

const SEVERITY_COLORS = {
  low: 'bg-blue-100 text-blue-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
}

export function ManagerDashboard() {
  const navigate = useNavigate()
  const [allCases, setAllCases] = useState<FullCaseView[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedQueue, setSelectedQueue] = useState<QueueName | null>(null)

  useEffect(() => {
    getAllCasesLive().then(cases => {
      setAllCases(cases)
      setLoading(false)
    })
  }, [])

  // Team Metrics
  const totalCases = allCases.length
  const withNextAppt = allCases.filter((c) => c.treatment.nextAppointmentDate).length
  const avgUrgency = Math.round(allCases.reduce((sum, c) => sum + c.scores.urgencyScore, 0) / totalCases)
  const stagnating = allCases.filter((c) => c.operational.treatmentGapDays > 14).length
  const highRisk = allCases.filter((c) => c.scores.urgencyScore >= 70).length

  const queueCounts = QUEUES.map((q) => ({
    ...q,
    count: allCases.filter(q.filter).length,
    cases: allCases.filter(q.filter),
  }))

  const selectedQueueData = selectedQueue ? queueCounts.find((q) => q.id === selectedQueue) : null

  if (loading) return <p className="text-muted-foreground">Loading dashboard...</p>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Manager Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Team overview — Caseload ({totalCases} cases)
        </p>
      </div>

      {/* Team Metrics */}
      <div className="grid grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{totalCases}</p>
            <p className="text-xs text-muted-foreground">Total Cases</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{withNextAppt}</p>
            <p className="text-xs text-muted-foreground">With Next Appt</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-orange-600">{stagnating}</p>
            <p className="text-xs text-muted-foreground">Stagnating</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{highRisk}</p>
            <p className="text-xs text-muted-foreground">High Risk</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{avgUrgency}</p>
            <p className="text-xs text-muted-foreground">Avg Urgency Score</p>
          </CardContent>
        </Card>
      </div>

      {/* Queues Grid */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Review Queues</h2>
        <div className="grid grid-cols-4 gap-3">
          {queueCounts.map((q) => (
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
                  <span className="text-2xl font-bold">{q.count}</span>
                </div>
                <p className="text-sm font-medium">{q.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{q.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Selected Queue Detail */}
      {selectedQueueData && selectedQueueData.cases.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{selectedQueueData.label} — {selectedQueueData.count} case(s)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {selectedQueueData.cases.map((cv) => (
                <div
                  key={cv.caseData.id}
                  className="flex items-center justify-between rounded border p-3 cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/case/${cv.caseData.id}`)}
                >
                  <div>
                    <p className="font-medium text-sm">{cv.client.fullName}</p>
                    <p className="text-xs text-muted-foreground">{cv.caseData.matterId}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground">Gap:</span>{' '}
                      <span className={cv.operational.treatmentGapDays > 21 ? 'text-red-500 font-medium' : ''}>
                        {cv.operational.treatmentGapDays}d
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Urgency:</span>{' '}
                      <span className="font-medium">{cv.scores.urgencyScore}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Engagement:</span>{' '}
                      <span className={cv.scores.clientEngagementScore < 30 ? 'text-red-500 font-medium' : 'font-medium'}>
                        {cv.scores.clientEngagementScore}
                      </span>
                    </div>
                    <Badge variant="secondary">
                      {cv.treatment.nextAppointmentDate ? 'Has Appt' : 'No Appt'}
                    </Badge>
                  </div>
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
