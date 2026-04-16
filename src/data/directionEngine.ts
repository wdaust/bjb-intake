import type { FullCaseView, DirectionalAssessment, CaseDirection, DirectionConfidence, CapturedCallData, CaseScores } from '@/types'

export function assessDirection(cv: FullCaseView): DirectionalAssessment {
  const { scores, treatment, operational, caseData } = cv

  // Cut review signals
  if (scores.caseWeaknessScore > 75 && scores.clientEngagementScore < 25) {
    return {
      primaryDirection: 'cut_review',
      confidence: 'moderate',
      reasoning: 'Minimal treatment development combined with persistent disengagement suggests cut review may be appropriate.',
      secondaryDirections: ['transfer_review'],
    }
  }

  // Transfer review signals
  if (caseData.transferRiskNote) {
    return {
      primaryDirection: 'transfer_review',
      confidence: 'moderate',
      reasoning: `Transfer consideration present: ${caseData.transferRiskNote}`,
      secondaryDirections: ['continue_treatment_optimization'],
    }
  }

  // Demand readiness signals
  if (scores.demandTrajectoryScore > 75 && scores.symptomPersistenceScore < 35) {
    return {
      primaryDirection: 'demand_readiness_review',
      confidence: 'moderate',
      reasoning: 'Treatment appears substantially progressed with improving symptoms. Case may be approaching demand readiness.',
      secondaryDirections: ['continue_treatment_optimization'],
    }
  }

  // Litigation review signals
  if (scores.symptomPersistenceScore > 75 && scores.treatmentContinuityScore < 30 && treatment.knownInjuries.length > 2) {
    return {
      primaryDirection: 'litigation_review',
      confidence: 'low',
      reasoning: 'Serious ongoing symptoms with poor treatment continuity may indicate litigation posture is more appropriate.',
      secondaryDirections: ['urgent_re_engagement'],
    }
  }

  // Urgent re-engagement
  if (operational.treatmentGapDays > 21 && scores.clientEngagementScore < 40) {
    return {
      primaryDirection: 'urgent_re_engagement',
      confidence: 'high',
      reasoning: `${operational.treatmentGapDays}-day treatment gap with declining engagement. Priority is re-establishing care.`,
      secondaryDirections: ['cut_review'],
    }
  }

  // Closer monitoring
  if (treatment.plateauIndicator || (scores.providerProgressionScore < 40 && scores.treatmentContinuityScore > 50)) {
    return {
      primaryDirection: 'closer_monitoring',
      confidence: 'moderate',
      reasoning: 'Treatment is active but progression quality may be declining. Closer monitoring needed.',
      secondaryDirections: ['next_level_care'],
    }
  }

  // Continue treatment (default healthy path)
  if (scores.treatmentContinuityScore > 70 && scores.clientEngagementScore > 70) {
    return {
      primaryDirection: 'continue_treatment_optimization',
      confidence: 'high',
      reasoning: 'Case appears on track with good treatment continuity and client engagement.',
    }
  }

  // Unresolved
  return {
    primaryDirection: 'unresolved',
    confidence: 'low',
    reasoning: 'Insufficient clarity on case direction. This call should help gather the facts needed for assessment.',
  }
}

export function updateDirection(
  current: DirectionalAssessment,
  data: CapturedCallData,
  scores: CaseScores
): DirectionalAssessment {
  let direction: CaseDirection = current.primaryDirection
  let confidence: DirectionConfidence = current.confidence
  let reasoning = current.reasoning

  // Treatment status impacts
  if (data.treatmentStatus === 'actively_treating' && data.symptomDirection === 'better') {
    if (scores.demandTrajectoryScore > 65) {
      direction = 'demand_readiness_review'
      confidence = 'moderate'
      reasoning = 'Client actively treating with improving symptoms. Demand readiness may be approaching.'
    } else {
      direction = 'continue_treatment_optimization'
      confidence = 'high'
      reasoning = 'Treatment is active and symptoms improving. Continue current path.'
    }
  }

  if (data.treatmentStatus === 'stopped_treating' && data.symptomDirection !== 'resolved') {
    if (data.barrierType === 'felt_better_stopped' && data.symptomDirection === 'better') {
      direction = 'demand_readiness_review'
      confidence = 'moderate'
      reasoning = 'Client stopped treating due to improvement. May be ready for demand review if treatment is truly complete.'
    } else {
      direction = 'urgent_re_engagement'
      confidence = 'high'
      reasoning = 'Treatment stopped with unresolved symptoms. Re-engagement is priority.'
    }
  }

  if (data.treatmentStatus === 'never_started') {
    if (scores.caseWeaknessScore > 70) {
      direction = 'cut_review'
      confidence = 'moderate'
      reasoning = 'No treatment initiated. Case may not be viable for continued management.'
    } else {
      direction = 'urgent_re_engagement'
      confidence = 'high'
      reasoning = 'Treatment never started. Immediate focus on establishing care.'
    }
  }

  if (data.symptomDirection === 'worse') {
    if (scores.symptomPersistenceScore > 70) {
      direction = 'next_level_care'
      confidence = 'moderate'
      reasoning = 'Worsening symptoms suggest current treatment path may be insufficient. Consider next-level care.'
    }
  }

  if (data.symptomDirection === 'resolved' && data.treatmentStatus !== 'actively_treating') {
    direction = 'demand_readiness_review'
    confidence = 'moderate'
    reasoning = 'Symptoms reported as resolved. Confirm treatment completion and assess demand readiness.'
  }

  return { primaryDirection: direction, confidence, reasoning, secondaryDirections: current.secondaryDirections }
}

export function generateWhyYouAreCalling(cv: FullCaseView): string {
  const { treatment, operational, scores, referrals } = cv
  const parts: string[] = []

  if (operational.treatmentGapDays > 21 && !treatment.nextAppointmentDate) {
    parts.push(`Client has gone ${operational.treatmentGapDays} days without treatment and no next appointment is on file.`)
  } else if (operational.treatmentGapDays > 14) {
    parts.push(`Client has a ${operational.treatmentGapDays}-day gap since last treatment.`)
  }

  if (operational.unresolvedReferralDays > 14) {
    const pending = referrals.filter(r => r.status === 'pending' || r.status === 'failed')
    const types = pending.map(r => r.providerType).join(', ')
    parts.push(`Unresolved ${types} referral(s) pending for ${operational.unresolvedReferralDays} days.`)
  }

  if (treatment.missedAppointments >= 3) {
    parts.push(`Client has missed ${treatment.missedAppointments} appointments, suggesting a pattern of inconsistency.`)
  }

  if (scores.symptomPersistenceScore > 60 && operational.treatmentGapDays > 14) {
    parts.push('Client previously reported ongoing symptoms but treatment progression appears stalled.')
  }

  if (scores.demandTrajectoryScore > 70) {
    parts.push('Client may be nearing demand readiness and treatment status needs confirmation.')
  }

  if (scores.clientEngagementScore < 30) {
    parts.push('Client engagement has been declining significantly. Re-engagement is a priority.')
  }

  if (operational.noContactDays > 21) {
    parts.push(`No successful contact in ${operational.noContactDays} days.`)
  }

  if (scores.caseWeaknessScore > 70) {
    parts.push('Case development has been weak. Internal directional review may be needed based on call findings.')
  }

  if (parts.length === 0) {
    parts.push('Scheduled follow-up to confirm treatment status and case progression.')
  }

  return parts.join(' ')
}

export function generateCallObjectives(cv: FullCaseView): string[] {
  const objectives: string[] = []
  const { treatment, operational, scores, referrals } = cv

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
  if (referrals.some(r => r.status === 'pending' || r.status === 'failed')) {
    objectives.push('Determine whether referral conversion has failed')
  }
  if (treatment.plateauIndicator) {
    objectives.push('Determine whether treatment has stalled or plateaued')
  }
  if (scores.demandTrajectoryScore > 60) {
    objectives.push('Evaluate whether case may be ready for demand review')
  }
  if (scores.caseWeaknessScore > 60) {
    objectives.push('Evaluate whether case should be flagged for cut or transfer review')
  }
  if (scores.symptomPersistenceScore > 70 && scores.treatmentContinuityScore < 40) {
    objectives.push('Evaluate whether case may require litigation review')
  }

  return objectives.slice(0, 7)
}

export function generateRisksAndWarnings(cv: FullCaseView): { label: string; severity: 'low' | 'medium' | 'high' | 'critical' }[] {
  const risks: { label: string; severity: 'low' | 'medium' | 'high' | 'critical' }[] = []
  const { treatment, operational, scores, caseData } = cv

  if (operational.treatmentGapDays > 21) risks.push({ label: 'Treatment Gap Risk — Critical', severity: 'critical' })
  else if (operational.treatmentGapDays > 14) risks.push({ label: 'Treatment Gap Risk', severity: 'high' })

  if (scores.symptomPersistenceScore > 60) risks.push({ label: 'Symptom Persistence Risk', severity: 'high' })
  if (scores.complianceScore < 30) risks.push({ label: 'Non-Compliance Risk', severity: 'high' })
  if (scores.caseWeaknessScore > 70) risks.push({ label: 'Weak Treatment Development', severity: 'critical' })
  if (scores.clientEngagementScore < 30) risks.push({ label: 'Client Disengagement Risk', severity: 'critical' })
  if (scores.barrierSeverityScore > 60) risks.push({ label: 'Barrier Escalation Risk', severity: 'high' })
  if (operational.unresolvedReferralDays > 14) risks.push({ label: 'Provider/Referral Failure Risk', severity: 'high' })

  if (scores.demandTrajectoryScore > 50 && scores.demandTrajectoryScore < 80) {
    risks.push({ label: 'Demand-Readiness Uncertainty', severity: 'medium' })
  }

  if (caseData.cutRiskNote) risks.push({ label: 'Cut Consideration', severity: 'high' })
  if (caseData.transferRiskNote) risks.push({ label: 'Transfer Consideration', severity: 'medium' })

  if (treatment.missedAppointments >= 3) risks.push({ label: `${treatment.missedAppointments} Missed Appointments`, severity: 'high' })

  return risks
}

export function generateToneGuidance(cv: FullCaseView): string {
  const { operational, scores, treatment } = cv

  if (scores.clientEngagementScore < 30 && operational.treatmentGapDays > 21) {
    return 'Begin warmly. Client has had treatment disruption and may feel embarrassed or discouraged. Use a calm and encouraging tone. Avoid making the client feel blamed for the gap. The goal is clarity and support, not pressure.'
  }
  if (scores.barrierSeverityScore > 60) {
    return 'Be especially patient. There are signs of barriers or overwhelm. Use gentle clarity — the objective is to understand and help, not interrogate. Validate difficulty before problem-solving.'
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
  if (operational.noContactDays > 21) {
    return 'It has been a while since contact. Reintroduce yourself warmly. Client may not remember details. Be patient and re-establish rapport before moving to case details.'
  }
  return 'Use a warm, conversational tone. Check in genuinely before moving to case details. Keep the pace relaxed and let the client feel cared about.'
}

export function generateBestNextMove(cv: FullCaseView, capturedData?: CapturedCallData): string {
  if (capturedData) {
    if (capturedData.nextAppointmentStatus === 'not_scheduled' && capturedData.symptomDirection !== 'resolved') {
      return 'Barrier identification mandatory — do not close call without next-step clarity'
    }
    if (capturedData.treatmentStatus === 'never_started') {
      return 'Establish treatment immediately — help client identify and schedule first appointment'
    }
    if (capturedData.treatmentStatus === 'stopped_treating' && capturedData.symptomDirection === 'worse') {
      return 'Escalate worsening symptoms to medical management lead. Re-engage care urgently.'
    }
    if (capturedData.symptomDirection === 'resolved' && capturedData.treatmentStatus !== 'actively_treating') {
      return 'Clarify whether treatment is truly complete and evaluate for demand-readiness review'
    }
    if (capturedData.barrierType === 'provider_not_responsive' || capturedData.barrierType === 'dissatisfied_with_provider') {
      return 'Resolve provider issue — create provider follow-up task or arrange alternative provider'
    }
  }

  const { scores, treatment, operational } = cv
  if (operational.treatmentGapDays > 21) return `Re-engage care after ${operational.treatmentGapDays}-day gap`
  if (!treatment.nextAppointmentDate) return 'Confirm or secure next appointment'
  if (operational.unresolvedReferralDays > 14) return 'Push unresolved referral to resolution'
  if (scores.demandTrajectoryScore > 70) return 'Evaluate for demand-readiness review'
  if (scores.caseWeaknessScore > 70) return 'Assess case viability for internal review'
  if (treatment.plateauIndicator) return 'Determine if next-level care is appropriate'
  return 'Confirm treatment progression and appointment continuity'
}
