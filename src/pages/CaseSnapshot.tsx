import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getCaseById, daysSince, daysUntil } from '@/data/mockData'
import type { FullCaseView } from '@/types'

const STAGE_LABELS: Record<string, string> = {
  early_case: 'Early Case',
  active_treatment: 'Active Treatment',
  mid_treatment: 'Mid Treatment',
  late_treatment: 'Late Treatment',
  demand_prep: 'Demand Prep',
  litigation: 'Litigation',
}

function generateWhyYouAreCalling(cv: FullCaseView): string {
  const { treatment, operational, scores } = cv
  const parts: string[] = []

  if (operational.treatmentGapDays > 21 && !treatment.nextAppointmentDate) {
    parts.push(`Client has gone ${operational.treatmentGapDays} days without treatment and no next appointment is on file.`)
  } else if (operational.treatmentGapDays > 14) {
    parts.push(`Client has a ${operational.treatmentGapDays}-day gap since last treatment.`)
  }

  if (operational.unresolvedReferralDays > 14) {
    parts.push(`An unresolved referral has been pending for ${operational.unresolvedReferralDays} days.`)
  }

  if (treatment.missedAppointments >= 3) {
    parts.push(`Client has missed ${treatment.missedAppointments} appointments, suggesting a pattern of inconsistency.`)
  }

  if (scores.symptomPersistenceScore > 60 && treatment.lastTreatmentDate) {
    parts.push('Client previously reported ongoing symptoms but treatment progression may be stalling.')
  }

  if (scores.demandTrajectoryScore > 70) {
    parts.push('Client may be nearing demand readiness and treatment status needs confirmation.')
  }

  if (scores.clientEngagementScore < 30) {
    parts.push('Client engagement has been declining. Re-engagement is a priority.')
  }

  if (operational.noContactDays > 21) {
    parts.push(`No successful contact in ${operational.noContactDays} days.`)
  }

  if (parts.length === 0) {
    parts.push('Scheduled follow-up to confirm treatment status and progression.')
  }

  return parts.join(' ')
}

function generateObjectives(cv: FullCaseView): string[] {
  const objectives: string[] = []
  const { treatment, operational, scores } = cv

  if (!treatment.lastTreatmentDate || operational.treatmentGapDays > 14) {
    objectives.push('Confirm whether client is actively treating')
  }
  if (treatment.lastTreatmentDate) {
    objectives.push('Confirm exact last appointment date and provider')
  }
  if (!treatment.nextAppointmentDate) {
    objectives.push('Identify whether next appointment is scheduled')
  }
  objectives.push('Clarify current symptom severity and direction')
  if (operational.treatmentGapDays > 14 || !treatment.nextAppointmentDate) {
    objectives.push('Identify barriers preventing continued care')
  }
  if (scores.demandTrajectoryScore > 60) {
    objectives.push('Evaluate whether case may be ready for demand review')
  }
  if (scores.caseWeaknessScore > 60) {
    objectives.push('Evaluate whether case should be flagged for cut or transfer review')
  }
  if (treatment.plateauIndicator) {
    objectives.push('Determine whether treatment has stalled or plateaued')
  }
  if (operational.unresolvedReferralDays > 7) {
    objectives.push('Determine whether referral conversion has failed')
  }

  return objectives.slice(0, 7)
}

function generateRisks(cv: FullCaseView): { label: string; severity: 'low' | 'medium' | 'high' | 'critical' }[] {
  const risks: { label: string; severity: 'low' | 'medium' | 'high' | 'critical' }[] = []
  const { operational, scores } = cv

  if (operational.treatmentGapDays > 21) risks.push({ label: 'Treatment Gap Risk', severity: 'critical' })
  else if (operational.treatmentGapDays > 14) risks.push({ label: 'Treatment Gap Risk', severity: 'high' })

  if (scores.symptomPersistenceScore > 60) risks.push({ label: 'Symptom Persistence Risk', severity: 'high' })
  if (scores.clientEngagementScore < 30) risks.push({ label: 'Client Disengagement Risk', severity: 'critical' })
  if (scores.complianceScore < 30) risks.push({ label: 'Non-Compliance Risk', severity: 'high' })
  if (scores.caseWeaknessScore > 70) risks.push({ label: 'Weak Treatment Development', severity: 'critical' })
  if (scores.barrierSeverityScore > 60) risks.push({ label: 'Barrier Escalation Risk', severity: 'high' })
  if (operational.unresolvedReferralDays > 14) risks.push({ label: 'Provider Failure Risk', severity: 'high' })

  const statuteDays = daysUntil(cv.caseData.statuteOfLimitationsDate)
  if (statuteDays < 180) risks.push({ label: `Statute Risk — ${statuteDays} days`, severity: 'critical' })
  else if (statuteDays < 365) risks.push({ label: `Statute — ${statuteDays} days`, severity: 'medium' })

  if (scores.demandTrajectoryScore > 60 && scores.demandTrajectoryScore < 80) {
    risks.push({ label: 'Demand-Readiness Uncertainty', severity: 'medium' })
  }
  if (cv.caseData.cutRiskNote) risks.push({ label: 'Cut Consideration', severity: 'high' })
  if (cv.caseData.transferRiskNote) risks.push({ label: 'Transfer Consideration', severity: 'medium' })

  return risks
}

function generateDirectionHypothesis(cv: FullCaseView): { direction: string; description: string } {
  const { scores, treatment, operational } = cv

  if (scores.caseWeaknessScore > 75 && scores.clientEngagementScore < 25) {
    return { direction: 'Cut Review', description: 'Weak treatment development and low engagement suggest cut review may be warranted.' }
  }
  if (cv.caseData.transferRiskNote) {
    return { direction: 'Transfer Review', description: 'Transfer considerations present. Clarify whether continued in-house handling is appropriate.' }
  }
  if (scores.demandTrajectoryScore > 75) {
    return { direction: 'Assess Demand Readiness', description: 'Treatment appears substantially progressed. Confirm whether case is approaching demand readiness.' }
  }
  if (scores.symptomPersistenceScore > 70 && scores.treatmentContinuityScore < 30) {
    return { direction: 'Urgent Re-Engagement', description: 'Active symptoms with poor treatment continuity. Priority is re-engaging care.' }
  }
  if (operational.treatmentGapDays > 21) {
    return { direction: 'Re-engage Care', description: 'Significant treatment gap. Restore continuity and identify barriers.' }
  }
  if (treatment.plateauIndicator) {
    return { direction: 'Assess Progression', description: 'Treatment may be plateauing. Determine if next-level care is needed.' }
  }
  return { direction: 'Continue Treatment Optimization', description: 'Case appears on track. Confirm treatment progression and continuity.' }
}

function generateToneGuidance(cv: FullCaseView): string {
  const { operational, scores, treatment } = cv

  if (scores.clientEngagementScore < 30 && operational.treatmentGapDays > 21) {
    return 'Begin warmly. Client has had treatment disruption and may feel embarrassed or discouraged. Use a calm and encouraging tone. Avoid making the client feel blamed for the gap. The goal is clarity and support, not pressure.'
  }
  if (scores.barrierSeverityScore > 60) {
    return 'Be especially patient. There are signs of barriers or overwhelm. Use gentle clarity. The objective is to understand and help, not interrogate. Validate difficulty before problem-solving.'
  }
  if (scores.symptomPersistenceScore > 70) {
    return 'Client may be dealing with ongoing pain. Lead with empathy and acknowledgment. Do not rush through symptom questions. Let the client feel heard.'
  }
  if (scores.demandTrajectoryScore > 70) {
    return 'This may be a demand-readiness clarification call. Be positive and supportive. Confirm treatment status thoroughly but do not create anxiety about the process.'
  }
  if (treatment.missedAppointments >= 3) {
    return 'Client has a pattern of missed appointments. Be calm and patient. Do not make the client feel judged. Use gentle clarity to understand what is happening.'
  }
  return 'Use a warm, conversational tone. Check in genuinely before moving to case details. Keep the pace relaxed and let the client feel cared about.'
}

export function CaseSnapshot() {
  const { caseId } = useParams<{ caseId: string }>()
  const navigate = useNavigate()
  const cv = getCaseById(caseId || '')

  if (!cv) {
    return <p className="text-muted-foreground">Case not found.</p>
  }

  const whyCalling = generateWhyYouAreCalling(cv)
  const objectives = generateObjectives(cv)
  const risks = generateRisks(cv)
  const dirHypothesis = generateDirectionHypothesis(cv)
  const toneGuide = generateToneGuidance(cv)

  const severityColors = {
    low: 'bg-blue-100 text-blue-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-orange-100 text-orange-800',
    critical: 'bg-red-100 text-red-800',
  }

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
        &larr; Back to Caseload
      </Button>

      {/* Section A: Client & Case Snapshot */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Client Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-y-1.5 text-sm">
            <div><span className="text-muted-foreground">Name:</span> <strong>{cv.client.fullName}</strong></div>
            <div><span className="text-muted-foreground">Preferred:</span> {cv.client.preferredName || '—'}</div>
            <div><span className="text-muted-foreground">Phone:</span> {cv.client.phone}</div>
            <div><span className="text-muted-foreground">DOB:</span> {new Date(cv.client.dateOfBirth).toLocaleDateString()}</div>
            <div><span className="text-muted-foreground">State:</span> {cv.client.state}</div>
            <div><span className="text-muted-foreground">Language:</span> {cv.client.primaryLanguage}</div>
            {cv.client.pronunciationNote && (
              <div className="col-span-2"><span className="text-muted-foreground">Pronunciation:</span> {cv.client.pronunciationNote}</div>
            )}
            {cv.client.workStatus && (
              <div className="col-span-2"><span className="text-muted-foreground">Work:</span> {cv.client.workStatus}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Case Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-y-1.5 text-sm">
            <div><span className="text-muted-foreground">Matter:</span> {cv.caseData.matterId}</div>
            <div><span className="text-muted-foreground">Type:</span> {cv.caseData.accidentType}</div>
            <div><span className="text-muted-foreground">DOL:</span> {new Date(cv.caseData.dateOfIncident).toLocaleDateString()} ({daysSince(cv.caseData.dateOfIncident)}d ago)</div>
            <div><span className="text-muted-foreground">Stage:</span> <Badge variant="secondary">{STAGE_LABELS[cv.caseData.currentStage]}</Badge></div>
            <div><span className="text-muted-foreground">Attorney:</span> {cv.caseData.attorneyAssigned}</div>
            <div><span className="text-muted-foreground">CM:</span> {cv.caseData.caseManagerAssigned}</div>
            {cv.caseData.medicalManagementLead && (
              <div><span className="text-muted-foreground">MML:</span> {cv.caseData.medicalManagementLead}</div>
            )}
            <div><span className="text-muted-foreground">SOL:</span> {new Date(cv.caseData.statuteOfLimitationsDate).toLocaleDateString()} ({daysUntil(cv.caseData.statuteOfLimitationsDate)}d)</div>
          </CardContent>
        </Card>
      </div>

      {/* Section B: Treatment Snapshot */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Treatment Snapshot</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Last Treatment</p>
              <p className="font-medium">
                {cv.treatment.lastTreatmentDate
                  ? `${new Date(cv.treatment.lastTreatmentDate).toLocaleDateString()} (${daysSince(cv.treatment.lastTreatmentDate)}d ago)`
                  : 'None'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Next Appointment</p>
              <p className={`font-medium ${cv.treatment.nextAppointmentDate ? 'text-green-600' : 'text-red-500'}`}>
                {cv.treatment.nextAppointmentDate
                  ? new Date(cv.treatment.nextAppointmentDate).toLocaleDateString()
                  : 'Not scheduled'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Treatment Gap</p>
              <p className={`font-medium ${cv.operational.treatmentGapDays > 21 ? 'text-red-500' : cv.operational.treatmentGapDays > 14 ? 'text-orange-500' : ''}`}>
                {cv.operational.treatmentGapDays} days
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Total Visits</p>
              <p className="font-medium">{cv.treatment.totalVisits ?? 0}</p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4 text-sm mt-3">
            <div>
              <p className="text-muted-foreground text-xs">Active Providers</p>
              <p className="font-medium">{cv.providers.filter((p) => p.status === 'active').length}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Open Referrals</p>
              <p className={`font-medium ${cv.referrals.filter((r) => r.status === 'pending').length > 0 ? 'text-orange-500' : ''}`}>
                {cv.referrals.filter((r) => r.status === 'pending' || r.status === 'failed').length}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Missed Appointments</p>
              <p className={`font-medium ${cv.treatment.missedAppointments >= 3 ? 'text-red-500' : ''}`}>{cv.treatment.missedAppointments}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Injuries</p>
              <p className="font-medium text-xs">{cv.treatment.knownInjuries.join(', ')}</p>
            </div>
          </div>
          <div className="mt-3 text-sm">
            <p className="text-muted-foreground text-xs">Symptoms</p>
            <p>{cv.treatment.symptomSummary}</p>
          </div>
          {cv.providers.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {cv.providers.map((p) => (
                <Badge key={p.id} variant={p.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                  {p.name} ({p.status})
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section C: Why You Are Calling */}
      <Card className="border-l-4 border-l-primary">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Why You Are Calling</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{whyCalling}</p>
        </CardContent>
      </Card>

      {/* Section D + E side by side */}
      <div className="grid grid-cols-2 gap-4">
        {/* Objectives */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Primary Call Objectives</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-1.5 text-sm">
              {objectives.map((obj, i) => (
                <li key={i}>{obj}</li>
              ))}
            </ol>
          </CardContent>
        </Card>

        {/* Risks */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Risks & Warnings</CardTitle>
          </CardHeader>
          <CardContent>
            {risks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No significant risks identified.</p>
            ) : (
              <div className="space-y-1.5">
                {risks.map((risk, i) => (
                  <div key={i} className={`rounded px-2.5 py-1 text-xs font-medium ${severityColors[risk.severity]}`}>
                    {risk.label}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Section F: Direction Hypothesis */}
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Best Direction Hypothesis</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-semibold text-sm">{dirHypothesis.direction}</p>
          <p className="text-sm text-muted-foreground mt-1">{dirHypothesis.description}</p>
          <p className="text-xs text-muted-foreground mt-2 italic">
            This is a working hypothesis based on known data. One objective of this call is to confirm or challenge this direction.
          </p>
        </CardContent>
      </Card>

      {/* Section G: Tone Guidance */}
      <Card className="bg-amber-50 border-amber-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-amber-900">Tone & Empathy Guidance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-amber-800 leading-relaxed">{toneGuide}</p>
        </CardContent>
      </Card>

      {/* Section H: Actions */}
      <div className="flex gap-3">
        <Button size="lg" onClick={() => navigate(`/call/${cv.caseData.id}`)}>
          Start Guided Call
        </Button>
        <Button variant="outline" onClick={() => navigate(`/timeline/${cv.caseData.id}`)}>
          View Timeline
        </Button>
        <Button variant="outline" disabled>View Prior Notes</Button>
        <Button variant="outline" disabled>Log Unable to Reach</Button>
      </div>
    </div>
  )
}
