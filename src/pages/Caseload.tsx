import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getAllCasesLive } from '@/data/liveData'
import { daysSince, daysUntil } from '@/data/mockData'
import type { FullCaseView, SortCriteria } from '@/types'

const STAGE_LABELS: Record<string, string> = {
  early_case: 'Early Case',
  active_treatment: 'Active Treatment',
  mid_treatment: 'Mid Treatment',
  late_treatment: 'Late Treatment',
  demand_prep: 'Demand Prep',
  litigation: 'Litigation',
  resolved: 'Resolved',
}

const SORT_OPTIONS: { value: SortCriteria; label: string }[] = [
  { value: 'treatment_gap', label: 'Longest Treatment Gap' },
  { value: 'no_next_appointment', label: 'No Next Appointment' },
  { value: 'no_contact', label: 'No Contact (Longest)' },
  { value: 'statute_urgency', label: 'Statute Urgency' },
  { value: 'worsening_symptoms', label: 'Worsening Symptoms' },
  { value: 'unresolved_referral', label: 'Unresolved Referral' },
  { value: 'no_treatment_started', label: 'No Treatment Started' },
  { value: 'missed_appointments', label: 'Missed Appointments' },
  { value: 'demand_ready', label: 'Possible Demand-Ready' },
  { value: 'litigation_review', label: 'Possible Litigation Review' },
  { value: 'cut_review', label: 'Possible Cut Review' },
  { value: 'transfer_review', label: 'Possible Transfer Review' },
  { value: 'high_disengagement', label: 'High Disengagement Risk' },
  { value: 'high_barrier', label: 'High Barrier Severity' },
]

const FILTER_PRESETS = [
  { label: 'All', value: 'all' },
  { label: 'Urgent', value: 'urgent' },
  { label: 'Treatment Gaps', value: 'gaps' },
  { label: 'No Appointment', value: 'no_appt' },
  { label: 'At Risk', value: 'at_risk' },
]

function getReasonForCall(cv: FullCaseView): string {
  const { treatment, operational } = cv
  if (operational.treatmentGapDays > 21 && !treatment.nextAppointmentDate) {
    return `${operational.treatmentGapDays}-day treatment gap. No next appointment on file.`
  }
  if (operational.noContactDays > 21) {
    return `No successful contact in ${operational.noContactDays} days.`
  }
  if (operational.unresolvedReferralDays > 14) {
    return `Unresolved referral for ${operational.unresolvedReferralDays} days.`
  }
  if (treatment.missedAppointments >= 3) {
    return `${treatment.missedAppointments} missed appointments. Pattern of inconsistency.`
  }
  if (cv.scores.demandTrajectoryScore > 70) {
    return 'May be nearing demand readiness. Treatment status confirmation needed.'
  }
  if (operational.treatmentGapDays > 14) {
    return `${operational.treatmentGapDays}-day gap since last treatment.`
  }
  return 'Scheduled follow-up. Confirm treatment status and progression.'
}

function getPriorityLevel(cv: FullCaseView): { label: string; color: string } {
  const score = cv.scores.urgencyScore
  if (score >= 80) return { label: 'Critical', color: 'bg-red-500 text-white' }
  if (score >= 60) return { label: 'High', color: 'bg-orange-500 text-white' }
  if (score >= 40) return { label: 'Medium', color: 'bg-yellow-500 text-black' }
  return { label: 'Low', color: 'bg-green-500 text-white' }
}

function getRiskFlags(cv: FullCaseView): { label: string; severity: string }[] {
  const flags: { label: string; severity: string }[] = []
  const { operational, treatment, scores } = cv
  if (operational.treatmentGapDays > 14) flags.push({ label: `${operational.treatmentGapDays}d gap`, severity: operational.treatmentGapDays > 21 ? 'critical' : 'warning' })
  if (!treatment.nextAppointmentDate) flags.push({ label: 'No next appt', severity: 'critical' })
  if (operational.noContactDays > 14) flags.push({ label: `${operational.noContactDays}d no contact`, severity: 'warning' })
  if (operational.unresolvedReferralDays > 7) flags.push({ label: 'Unresolved referral', severity: 'warning' })
  if (treatment.missedAppointments >= 3) flags.push({ label: `${treatment.missedAppointments} missed`, severity: 'warning' })
  if (scores.caseWeaknessScore > 70) flags.push({ label: 'Weak case', severity: 'critical' })
  if (scores.clientEngagementScore < 30) flags.push({ label: 'Disengaged', severity: 'critical' })
  if (treatment.plateauIndicator) flags.push({ label: 'Plateau', severity: 'warning' })
  return flags
}

function sortCases(cases: FullCaseView[], criteria: SortCriteria): FullCaseView[] {
  return [...cases].sort((a, b) => {
    switch (criteria) {
      case 'treatment_gap': return b.operational.treatmentGapDays - a.operational.treatmentGapDays
      case 'no_next_appointment': {
        const aHas = a.treatment.nextAppointmentDate ? 1 : 0
        const bHas = b.treatment.nextAppointmentDate ? 1 : 0
        return aHas - bHas || b.operational.treatmentGapDays - a.operational.treatmentGapDays
      }
      case 'no_contact': return b.operational.noContactDays - a.operational.noContactDays
      case 'statute_urgency': return daysUntil(a.caseData.statuteOfLimitationsDate) - daysUntil(b.caseData.statuteOfLimitationsDate)
      case 'worsening_symptoms': return b.scores.symptomPersistenceScore - a.scores.symptomPersistenceScore
      case 'unresolved_referral': return b.operational.unresolvedReferralDays - a.operational.unresolvedReferralDays
      case 'no_treatment_started': return (a.treatment.totalVisits || 0) - (b.treatment.totalVisits || 0)
      case 'missed_appointments': return b.treatment.missedAppointments - a.treatment.missedAppointments
      case 'demand_ready': return b.scores.demandTrajectoryScore - a.scores.demandTrajectoryScore
      case 'litigation_review': return b.scores.symptomPersistenceScore - a.scores.symptomPersistenceScore
      case 'cut_review': return b.scores.caseWeaknessScore - a.scores.caseWeaknessScore
      case 'transfer_review': return (b.caseData.transferRiskNote ? 1 : 0) - (a.caseData.transferRiskNote ? 1 : 0)
      case 'high_disengagement': return a.scores.clientEngagementScore - b.scores.clientEngagementScore
      case 'high_barrier': return b.scores.barrierSeverityScore - a.scores.barrierSeverityScore
      default: return b.scores.urgencyScore - a.scores.urgencyScore
    }
  })
}

export function Caseload() {
  const navigate = useNavigate()
  const [allCases, setAllCases] = useState<FullCaseView[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortCriteria>('treatment_gap')
  const [filterPreset, setFilterPreset] = useState('all')

  useEffect(() => {
    getAllCasesLive().then(cases => {
      setAllCases(cases)
      setLoading(false)
    })
  }, [])

  const filteredCases = useMemo(() => {
    let cases = allCases

    // Search
    if (search) {
      const q = search.toLowerCase()
      cases = cases.filter(
        (c) =>
          c.client.fullName.toLowerCase().includes(q) ||
          c.caseData.matterId.toLowerCase().includes(q)
      )
    }

    // Filter presets
    switch (filterPreset) {
      case 'urgent':
        cases = cases.filter((c) => c.scores.urgencyScore >= 70)
        break
      case 'gaps':
        cases = cases.filter((c) => c.operational.treatmentGapDays > 14)
        break
      case 'no_appt':
        cases = cases.filter((c) => !c.treatment.nextAppointmentDate)
        break
      case 'at_risk':
        cases = cases.filter(
          (c) => c.scores.caseWeaknessScore > 60 || c.scores.clientEngagementScore < 40
        )
        break
    }

    return sortCases(cases, sortBy)
  }, [allCases, search, sortBy, filterPreset])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Caseload</h1>
        <p className="text-sm text-muted-foreground">
          {allCases.length} assigned clients — Sarah Chen
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search by name or matter ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
        <Select value={sortBy} onValueChange={(v) => { if (v) setSortBy(v as SortCriteria) }}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Sort by..." />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-1">
          {FILTER_PRESETS.map((fp) => (
            <Button
              key={fp.value}
              size="sm"
              variant={filterPreset === fp.value ? 'default' : 'outline'}
              onClick={() => setFilterPreset(fp.value)}
            >
              {fp.label}
            </Button>
          ))}
        </div>
      </div>

      {loading && <p className="text-muted-foreground">Loading caseload from Litify...</p>}

      {/* Client List */}
      <div className="space-y-2">
        {filteredCases.map((cv) => {
          const priority = getPriorityLevel(cv)
          const riskFlags = getRiskFlags(cv)
          const reason = getReasonForCall(cv)

          return (
            <Card
              key={cv.caseData.id}
              className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30"
              onClick={() => navigate(`/case/${cv.caseData.id}`)}
            >
              <CardContent className="p-4">
                <div className="grid grid-cols-12 gap-4 items-center">
                  {/* Name + ID */}
                  <div className="col-span-3">
                    <p className="font-semibold">{cv.client.fullName}</p>
                    <p className="text-xs text-muted-foreground">{cv.caseData.matterId}</p>
                  </div>

                  {/* Stage + State */}
                  <div className="col-span-1">
                    <p className="text-xs font-medium">{STAGE_LABELS[cv.caseData.currentStage]}</p>
                    <p className="text-xs text-muted-foreground">{cv.client.state}</p>
                  </div>

                  {/* Last Contact + Last Treatment */}
                  <div className="col-span-2">
                    <p className="text-xs">
                      <span className="text-muted-foreground">Contact:</span>{' '}
                      {cv.operational.lastContactDate
                        ? `${daysSince(cv.operational.lastContactDate)}d ago`
                        : 'Never'}
                    </p>
                    <p className="text-xs">
                      <span className="text-muted-foreground">Treatment:</span>{' '}
                      {cv.treatment.lastTreatmentDate
                        ? `${daysSince(cv.treatment.lastTreatmentDate)}d ago`
                        : 'Never'}
                    </p>
                  </div>

                  {/* Next Appointment */}
                  <div className="col-span-1">
                    <p className="text-xs text-muted-foreground">Next Appt</p>
                    {cv.treatment.nextAppointmentDate ? (
                      <p className="text-xs font-medium text-green-600">
                        {new Date(cv.treatment.nextAppointmentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    ) : (
                      <p className="text-xs font-medium text-red-500">None</p>
                    )}
                  </div>

                  {/* Priority */}
                  <div className="col-span-1">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${priority.color}`}>
                      {priority.label}
                    </span>
                  </div>

                  {/* Risk Flags */}
                  <div className="col-span-2 flex flex-wrap gap-1">
                    {riskFlags.slice(0, 3).map((flag, i) => (
                      <Badge
                        key={i}
                        variant={flag.severity === 'critical' ? 'destructive' : 'secondary'}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {flag.label}
                      </Badge>
                    ))}
                    {riskFlags.length > 3 && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        +{riskFlags.length - 3}
                      </Badge>
                    )}
                  </div>

                  {/* Reason */}
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground leading-tight">{reason}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}

        {filteredCases.length === 0 && (
          <p className="text-center text-muted-foreground py-8">No cases match your filters.</p>
        )}
      </div>
    </div>
  )
}
