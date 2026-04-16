import type { FullCaseView, CaseScores, CapturedCallData } from '@/types'
import { daysSince, daysUntil } from './mockData'

export function calculateScores(cv: FullCaseView): CaseScores {
  const { treatment, operational, providers, referrals, caseData } = cv

  // Treatment Continuity (high = good continuity)
  let treatmentContinuity = 100
  if (operational.treatmentGapDays > 30) treatmentContinuity -= 50
  else if (operational.treatmentGapDays > 21) treatmentContinuity -= 35
  else if (operational.treatmentGapDays > 14) treatmentContinuity -= 20
  if (treatment.missedAppointments >= 4) treatmentContinuity -= 25
  else if (treatment.missedAppointments >= 2) treatmentContinuity -= 15
  if (!treatment.nextAppointmentDate) treatmentContinuity -= 20
  const activeProviders = providers.filter(p => p.status === 'active').length
  if (activeProviders === 0) treatmentContinuity -= 20
  treatmentContinuity = Math.max(0, Math.min(100, treatmentContinuity))

  // Symptom Persistence (high = symptoms persisting/worsening)
  let symptomPersistence = 50
  const daysSinceIncident = daysSince(caseData.dateOfIncident)
  if (daysSinceIncident > 365) symptomPersistence += 15
  if (treatment.knownInjuries.length > 2) symptomPersistence += 10
  if (treatment.plateauIndicator) symptomPersistence += 15
  if (treatment.dischargeStatus === 'none' && daysSinceIncident > 180) symptomPersistence += 10
  if (treatment.surgeryRecommendationStatus === 'recommended') symptomPersistence += 15
  if (treatment.dischargeStatus === 'full') symptomPersistence -= 30
  symptomPersistence = Math.max(0, Math.min(100, symptomPersistence))

  // Barrier Severity (high = severe barriers)
  let barrierSeverity = 0
  if (operational.unresolvedReferralDays > 30) barrierSeverity += 30
  else if (operational.unresolvedReferralDays > 14) barrierSeverity += 20
  const failedRefs = referrals.filter(r => r.status === 'failed').length
  barrierSeverity += failedRefs * 20
  if (treatment.missedAppointments >= 3) barrierSeverity += 20
  if (operational.noContactDays > 21) barrierSeverity += 15
  const dissatisfied = providers.some(p => p.dissatisfactionNote)
  if (dissatisfied) barrierSeverity += 15
  barrierSeverity = Math.max(0, Math.min(100, barrierSeverity))

  // Provider Progression (high = good progression)
  let providerProgression = 50
  if (activeProviders >= 2) providerProgression += 20
  else if (activeProviders === 1) providerProgression += 10
  else providerProgression -= 30
  const completedRefs = referrals.filter(r => r.status === 'completed').length
  providerProgression += completedRefs * 10
  const pendingRefs = referrals.filter(r => r.status === 'pending' || r.status === 'failed').length
  providerProgression -= pendingRefs * 15
  if (treatment.diagnosticsCompleted.length > 0) providerProgression += 10
  if (treatment.injectionRecommendationStatus === 'completed') providerProgression += 10
  providerProgression = Math.max(0, Math.min(100, providerProgression))

  // Client Engagement (high = good engagement)
  let engagement = 70
  if (operational.noContactDays > 30) engagement -= 40
  else if (operational.noContactDays > 14) engagement -= 20
  if (treatment.missedAppointments >= 4) engagement -= 30
  else if (treatment.missedAppointments >= 2) engagement -= 15
  if (operational.treatmentGapDays > 30) engagement -= 20
  if ((treatment.totalVisits || 0) < 5 && daysSinceIncident > 90) engagement -= 20
  engagement = Math.max(0, Math.min(100, engagement))

  // Compliance (high = good compliance)
  let compliance = 80
  if (treatment.missedAppointments >= 4) compliance -= 40
  else if (treatment.missedAppointments >= 2) compliance -= 20
  if (!treatment.nextAppointmentDate && operational.treatmentGapDays > 14) compliance -= 25
  if (operational.staleTasks > 0) compliance -= 10
  compliance = Math.max(0, Math.min(100, compliance))

  // Demand Trajectory (high = closer to demand readiness)
  let demandTrajectory = 0
  if (treatment.dischargeStatus === 'partial') demandTrajectory += 25
  if (treatment.dischargeStatus === 'full') demandTrajectory += 40
  if ((treatment.totalVisits || 0) > 20) demandTrajectory += 15
  if (treatment.diagnosticsCompleted.length >= 2) demandTrajectory += 10
  if (treatment.injectionRecommendationStatus === 'completed') demandTrajectory += 10
  if (pendingRefs === 0 && activeProviders > 0) demandTrajectory += 10
  if (treatment.plateauIndicator) demandTrajectory += 5
  if (operational.treatmentGapDays > 21) demandTrajectory -= 15
  if (!treatment.lastTreatmentDate) demandTrajectory -= 30
  demandTrajectory = Math.max(0, Math.min(100, demandTrajectory))

  // Urgency (high = needs immediate attention)
  let urgency = 0
  if (operational.treatmentGapDays > 30) urgency += 25
  else if (operational.treatmentGapDays > 14) urgency += 15
  if (operational.noContactDays > 21) urgency += 20
  if (!treatment.nextAppointmentDate) urgency += 15
  if (operational.unresolvedReferralDays > 14) urgency += 15
  const statuteDays = daysUntil(caseData.statuteOfLimitationsDate)
  if (statuteDays < 180) urgency += 30
  else if (statuteDays < 365) urgency += 10
  if (operational.staleTasks > 1) urgency += 10
  urgency = Math.max(0, Math.min(100, urgency))

  // Case Weakness (high = weak case)
  let caseWeakness = 0
  if ((treatment.totalVisits || 0) < 5 && daysSinceIncident > 90) caseWeakness += 30
  if (engagement < 30) caseWeakness += 25
  if (operational.treatmentGapDays > 30) caseWeakness += 20
  if (compliance < 30) caseWeakness += 15
  if (!treatment.treatmentStartDate && daysSinceIncident > 60) caseWeakness += 30
  caseWeakness = Math.max(0, Math.min(100, caseWeakness))

  // Direction Confidence (high = clear direction)
  let directionConfidence = 50
  if (demandTrajectory > 70) directionConfidence += 25
  if (caseWeakness > 70) directionConfidence += 15 // clear it should be cut
  if (treatmentContinuity > 80 && engagement > 80) directionConfidence += 15
  if (operational.treatmentGapDays > 21 && engagement < 30) directionConfidence -= 20
  if (barrierSeverity > 60) directionConfidence -= 15
  directionConfidence = Math.max(0, Math.min(100, directionConfidence))

  return {
    treatmentContinuityScore: treatmentContinuity,
    symptomPersistenceScore: symptomPersistence,
    barrierSeverityScore: barrierSeverity,
    providerProgressionScore: providerProgression,
    clientEngagementScore: engagement,
    complianceScore: compliance,
    demandTrajectoryScore: demandTrajectory,
    urgencyScore: urgency,
    caseWeaknessScore: caseWeakness,
    directionConfidenceScore: directionConfidence,
  }
}

export function updateScoresFromCallData(baseScores: CaseScores, data: CapturedCallData): CaseScores {
  const scores = { ...baseScores }

  // Treatment status impacts
  if (data.treatmentStatus === 'actively_treating') {
    scores.treatmentContinuityScore = Math.min(100, scores.treatmentContinuityScore + 15)
    scores.clientEngagementScore = Math.min(100, scores.clientEngagementScore + 10)
  } else if (data.treatmentStatus === 'stopped_treating') {
    scores.treatmentContinuityScore = Math.max(0, scores.treatmentContinuityScore - 20)
    scores.urgencyScore = Math.min(100, scores.urgencyScore + 15)
  } else if (data.treatmentStatus === 'never_started') {
    scores.treatmentContinuityScore = Math.max(0, scores.treatmentContinuityScore - 30)
    scores.caseWeaknessScore = Math.min(100, scores.caseWeaknessScore + 25)
    scores.urgencyScore = Math.min(100, scores.urgencyScore + 20)
  }

  // Symptom impacts
  if (data.symptomDirection === 'worse') {
    scores.symptomPersistenceScore = Math.min(100, scores.symptomPersistenceScore + 20)
    scores.urgencyScore = Math.min(100, scores.urgencyScore + 10)
  } else if (data.symptomDirection === 'better') {
    scores.symptomPersistenceScore = Math.max(0, scores.symptomPersistenceScore - 15)
    scores.demandTrajectoryScore = Math.min(100, scores.demandTrajectoryScore + 10)
  } else if (data.symptomDirection === 'resolved') {
    scores.symptomPersistenceScore = Math.max(0, scores.symptomPersistenceScore - 30)
    scores.demandTrajectoryScore = Math.min(100, scores.demandTrajectoryScore + 25)
  }

  // Appointment impacts
  if (data.nextAppointmentStatus === 'scheduled') {
    scores.treatmentContinuityScore = Math.min(100, scores.treatmentContinuityScore + 10)
    scores.complianceScore = Math.min(100, scores.complianceScore + 10)
  } else if (data.nextAppointmentStatus === 'not_scheduled') {
    scores.treatmentContinuityScore = Math.max(0, scores.treatmentContinuityScore - 15)
    scores.urgencyScore = Math.min(100, scores.urgencyScore + 10)
  }

  // Barrier impacts
  if (data.barrierType) {
    scores.barrierSeverityScore = Math.min(100, scores.barrierSeverityScore + 20)
    if (data.barrierType === 'felt_better_stopped') {
      scores.demandTrajectoryScore = Math.min(100, scores.demandTrajectoryScore + 10)
    }
    if (data.barrierType === 'dissatisfied_with_provider' || data.barrierType === 'provider_not_responsive') {
      scores.providerProgressionScore = Math.max(0, scores.providerProgressionScore - 15)
    }
  }

  // Progression impacts
  if (data.progressionQuality === 'helping_a_lot') {
    scores.providerProgressionScore = Math.min(100, scores.providerProgressionScore + 15)
    scores.demandTrajectoryScore = Math.min(100, scores.demandTrajectoryScore + 10)
  } else if (data.progressionQuality === 'feels_stalled' || data.progressionQuality === 'not_helping') {
    scores.providerProgressionScore = Math.max(0, scores.providerProgressionScore - 15)
    scores.urgencyScore = Math.min(100, scores.urgencyScore + 10)
  }

  // Engagement from call itself
  if (data.engagementLevel === 'engaged') {
    scores.clientEngagementScore = Math.min(100, scores.clientEngagementScore + 10)
  } else if (data.engagementLevel === 'disengaged') {
    scores.clientEngagementScore = Math.max(0, scores.clientEngagementScore - 20)
    scores.caseWeaknessScore = Math.min(100, scores.caseWeaknessScore + 10)
  }

  return scores
}
