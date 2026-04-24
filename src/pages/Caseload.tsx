import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { getAllCasesLive, getCaseManagers, searchCases, getCmStats, type CmStats, type ServerSortKey } from '@/data/liveData'
import { useQueue, DEFAULT_CM_ID, DEFAULT_CM_NAME } from '@/lib/QueueContext'
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
  if (score >= 80) return { label: 'Critical', color: 'bg-red-500/20 text-red-400 border border-red-500/30' }
  if (score >= 60) return { label: 'High', color: 'bg-orange-500/20 text-orange-400 border border-orange-500/30' }
  if (score >= 40) return { label: 'Medium', color: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' }
  return { label: 'Low', color: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' }
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
  const [cmList, setCmList] = useState<{ id: string; name: string; roles: string; caseCount: number }[]>([])
  const [selectedCm, setSelectedCm] = useState<string>(DEFAULT_CM_ID)
  const [selectedCmName, setSelectedCmName] = useState<string>(DEFAULT_CM_NAME)
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [pageSize, setPageSize] = useState(50)

  const { setQueue } = useQueue()
  const [cmStats, setCmStats] = useState<CmStats>({ totalCases: 0, urgent: 0, gap14: 0, noRecentTreatment: 0 })

  // Load CM list on mount
  useEffect(() => {
    getCaseManagers().then(setCmList)
  }, [])

  // Load stats for selected CM (across ALL their cases)
  useEffect(() => {
    getCmStats(selectedCm || undefined).then(setCmStats)
  }, [selectedCm])

  // Map the current client-side sort selection onto the server-side
  // sort keys that are DB-derivable. Score-based sorts (urgency, demand
  // trajectory, etc.) still sort the returned page locally below;
  // server-side sort only wins for criteria that map cleanly to SQL
  // columns. Without this, Page 1 would always return the newest 50
  // matters and the UI sort would just reshuffle that small slice —
  // masking whichever longest-gap / most-urgent cases live deeper in
  // the result set.
  const serverSort: ServerSortKey =
    sortBy === 'treatment_gap' || sortBy === 'statute_urgency' || sortBy === 'no_contact'
      ? sortBy
      : 'open_date_desc'

  // Load cases when CM selection, page, or sort changes. Cancellation-
  // aware: if the user flips quickly, stale responses are dropped.
  useEffect(() => {
    if (search.length >= 2) return // search effect owns this state window
    let cancelled = false
    setLoading(true)
    getAllCasesLive(selectedCm || undefined, page, serverSort).then((result) => {
      if (cancelled) return
      setAllCases(result.cases)
      setTotalCount(result.totalCount)
      setPageSize(result.pageSize)
      setQueue(result.cases) // populate queue for sidebar navigation
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [selectedCm, page, search, serverSort, setQueue])

  // Server-side search with debounce. Cancellation-aware + resets back
  // to the paginated list when the query is cleared to < 2 chars.
  useEffect(() => {
    if (search.length < 2) {
      // When the user shortens/clears the query, drop any lingering
      // search results so the effect above repopulates paginated data.
      setAllCases([])
      return
    }
    let cancelled = false
    setLoading(true)
    const timer = setTimeout(() => {
      searchCases(search).then((results) => {
        if (cancelled) return
        setAllCases(results)
        setTotalCount(results.length)
        setLoading(false)
      })
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [search])

  const totalPages = Math.ceil(totalCount / pageSize)

  const filteredCases = useMemo(() => {
    let cases = allCases

    // Filter presets (search is now server-side)
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

    // When the server already sorted (treatment_gap, statute_urgency,
    // no_contact), trust its order and skip the client-side sort.
    // Otherwise the client comparator fights the server:
    //   - Server puts NULL-data cases last (NULLS LAST)
    //   - Client's `treatmentGapDays` uses the sentinel 999 for NULL
    //     data, which makes `b.gap - a.gap` float NULL cases to the top
    // Score-based sorts that the server can't express still run locally.
    if (serverSort !== 'open_date_desc') return cases
    return sortCases(cases, sortBy)
  }, [allCases, search, sortBy, filterPreset, serverSort])

  function getInitials(name: string): string {
    return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
  }
  function getInitialColor(name: string): string {
    const colors = ['bg-blue-500','bg-purple-500','bg-teal-500','bg-pink-500','bg-orange-500','bg-cyan-500','bg-indigo-500','bg-emerald-500','bg-rose-500','bg-amber-500']
    let hash = 0; for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
    return colors[Math.abs(hash) % colors.length] ?? colors[0]!
  }

  return (
    <div className="space-y-4 page-enter">
      {/* Daily Stats Banner */}
      <div className="rounded-xl border border-border/30 bg-gradient-to-r from-primary/5 via-transparent to-teal-500/5 p-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-5">
            <div className="text-center">
              <p className="text-2xl font-bold stat-number">{cmStats.totalCases.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Cases</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-400 stat-number">{cmStats.urgent.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Urgent</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-400 stat-number">{cmStats.gap14.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Gap 14d+</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-400 stat-number">{cmStats.noRecentTreatment.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">No Recent Tx</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium">{selectedCmName || 'All Cases'}</p>
            <p className="text-xs text-muted-foreground">Page {page + 1} of {totalPages}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Caseload</h1>
          <p className="text-sm text-muted-foreground">
            Showing {filteredCases.length} of {totalCount.toLocaleString()} cases{selectedCmName ? ` — ${selectedCmName}` : ''} (Page {page + 1} of {totalPages})
          </p>
        </div>
        <Select
          value={selectedCm}
          onValueChange={(v) => {
            setPage(0)
            if (v === '__all__') {
              setSelectedCm('')
              setSelectedCmName('')
            } else if (v) {
              setSelectedCm(v)
              setSelectedCmName(cmList.find(c => c.id === v)?.name || '')
            }
          }}
        >
          <SelectTrigger className="w-96">
            <span className="truncate">
              {selectedCmName
                ? `${selectedCmName} — ${cmList.find(c => c.id === selectedCm)?.caseCount || 0} cases`
                : 'All Cases (select team member to filter)'}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Cases</SelectItem>
            {cmList.map((cm) => (
              <SelectItem key={cm.id} value={cm.id}>
                {cm.name} — {cm.caseCount} cases{cm.roles ? ` (${cm.roles})` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
          <SelectTrigger className="w-72">
            <span className="truncate">{SORT_OPTIONS.find(o => o.value === sortBy)?.label || 'Sort by...'}</span>
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
              className="cursor-pointer card-hover border-border/50"
              onClick={() => navigate(`/case/${cv.caseData.id}`)}
            >
              <CardContent className="p-4">
                <div className="grid grid-cols-12 gap-4 items-center">
                  {/* Avatar + Name */}
                  <div className="col-span-3 flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${getInitialColor(cv.client.fullName)}`}>
                      {getInitials(cv.client.fullName)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{cv.client.fullName}</p>
                      <p className="text-xs text-muted-foreground">{cv.caseData.matterId}</p>
                    </div>
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
                      <p className="text-xs font-medium text-emerald-400">
                        {new Date(cv.treatment.nextAppointmentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    ) : (
                      <p className="text-xs font-medium text-red-400">None</p>
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

        {filteredCases.length === 0 && !loading && (
          <p className="text-center text-muted-foreground py-8">No cases match your filters.</p>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0 || loading}
            onClick={() => setPage(0)}
          >
            First
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0 || loading}
            onClick={() => setPage(p => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground px-3">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1 || loading}
            onClick={() => setPage(p => p + 1)}
          >
            Next
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1 || loading}
            onClick={() => setPage(totalPages - 1)}
          >
            Last
          </Button>
        </div>
      )}
    </div>
  )
}
