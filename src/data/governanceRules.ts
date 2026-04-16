import type { CapturedCallData, FullCaseView, CaseScores, DirectionalAssessment, PostCallSummary, TaskItem, CaseDirection } from '@/types'

const DIRECTION_LABELS: Record<CaseDirection, string> = {
  continue_treatment_optimization: 'Continue Treatment Optimization',
  closer_monitoring: 'Closer Monitoring Needed',
  urgent_re_engagement: 'Urgent Re-Engagement',
  next_level_care: 'Next-Level Care Consideration',
  demand_readiness_review: 'Demand-Readiness Review',
  litigation_review: 'Litigation Review',
  cut_review: 'Cut Review',
  transfer_review: 'Transfer Review',
  escalate_for_review: 'Escalate for Review',
  unresolved: 'Unresolved — Additional Facts Needed',
}

// Required fields before closing a successful live contact (Spec 27.1/29.1)
export function getRequiredFieldsForClose(): string[] {
  return [
    'treatmentStatus',
    'symptomDirection',
    'nextAppointmentStatus',
    'directionAssessment',
  ]
}

// Validate if call can be closed (Spec 27.1)
export function validateCallComplete(data: CapturedCallData): {
  valid: boolean
  missingFields: string[]
  warnings: string[]
} {
  const required = getRequiredFieldsForClose()
  const missingFields: string[] = []
  const warnings: string[] = []

  for (const field of required) {
    if (!(data as Record<string, unknown>)[field]) {
      missingFields.push(field)
    }
  }

  // Check mandatory clarification rules
  const clarifications = checkMandatoryClarifications(data)
  warnings.push(...clarifications)

  return {
    valid: missingFields.length === 0 && warnings.length === 0,
    missingFields,
    warnings,
  }
}

// Mandatory clarification rules (Spec 27.2/29.2)
export function checkMandatoryClarifications(data: CapturedCallData): string[] {
  const warnings: string[] = []

  // Active symptoms + no next appointment = must capture barrier
  if (
    data.symptomDirection &&
    data.symptomDirection !== 'resolved' &&
    data.nextAppointmentStatus === 'not_scheduled' &&
    !data.barrierType
  ) {
    warnings.push('Active symptoms with no next appointment — barrier identification is required before closing.')
  }

  // Stopped treatment + unclear reason
  if (data.treatmentStatus === 'stopped_treating' && !data.barrierType) {
    warnings.push('Client stopped treatment — reason must be captured before closing.')
  }

  // Says "better" but no discharge context
  if (
    data.symptomDirection === 'better' &&
    data.treatmentStatus === 'stopped_treating' &&
    !data.progressionQuality
  ) {
    warnings.push('Client says "better" but stopped treating — clarify whether treatment concluded appropriately.')
  }

  // Says "worse" but no escalation assessment
  if (data.symptomDirection === 'worse' && !data.escalationFlag) {
    warnings.push('Client reports worsening symptoms — escalation assessment should be completed.')
  }

  // Vague treatment status
  if (data.treatmentStatus === 'unclear' || data.treatmentStatus === 'evasive') {
    warnings.push('Treatment status remains unclear — additional clarification needed.')
  }

  // Near demand but unresolved treatment facts
  if (
    data.directionAssessment === 'demand_readiness_review' &&
    (!data.nextAppointmentStatus || !data.progressionQuality)
  ) {
    warnings.push('Demand direction indicated but treatment facts are incomplete.')
  }

  // Cut/transfer/litigation direction without structured signal
  if (
    (data.directionAssessment === 'cut_review' ||
      data.directionAssessment === 'transfer_review' ||
      data.directionAssessment === 'litigation_review') &&
    !data.escalationFlag
  ) {
    warnings.push('Directional review indicated — escalation flag should be set.')
  }

  return warnings
}

// Auto-generate post-call summary (Spec 33)
export function generatePostCallSummary(
  cv: FullCaseView,
  data: CapturedCallData,
  _scores: CaseScores,
  direction: DirectionalAssessment
): PostCallSummary {
  const statusMap: Record<string, string> = {
    actively_treating: 'Client is currently in active treatment.',
    stopped_treating: 'Client has stopped treating.',
    never_started: 'Client has never started treatment.',
    inconsistent: 'Client has been treating inconsistently.',
    unclear: 'Treatment status remains unclear.',
    evasive: 'Client was evasive about treatment status.',
  }

  const symptomMap: Record<string, string> = {
    better: 'Symptoms reported as improving.',
    worse: 'Symptoms reported as worsening.',
    same: 'Symptoms reported as unchanged.',
    fluctuates: 'Symptoms reported as fluctuating.',
    resolved: 'Symptoms reported as resolved.',
    hard_to_describe: 'Client had difficulty describing symptom status.',
  }

  const apptMap: Record<string, string> = {
    scheduled: 'Next appointment is scheduled.',
    not_scheduled: 'No next appointment is currently scheduled.',
    waiting_callback: 'Waiting for provider callback.',
    referral_not_scheduled: 'Referral made but not yet scheduled.',
    finished_no_next: 'Finished with current provider, no next step.',
    not_sure: 'Client unsure about next appointment.',
  }

  // What changed
  const whatChanged: string[] = []
  if (data.treatmentStatus) whatChanged.push('Treatment status clarified')
  if (data.nextAppointmentDate) whatChanged.push('Next appointment confirmed')
  if (data.nextAppointmentStatus === 'not_scheduled') whatChanged.push('Treatment gap identified — no next appointment')
  if (data.barrierType) whatChanged.push(`Barrier discovered: ${data.barrierType.replace(/_/g, ' ')}`)
  if (data.symptomDirection === 'worse') whatChanged.push('Worsening symptoms reported — may need escalation')
  if (data.symptomDirection === 'better' || data.symptomDirection === 'resolved') whatChanged.push('Symptom improvement reported')
  if (data.escalationFlag) whatChanged.push('Escalation triggered')

  // Auto tasks
  const tasks = generateAutoTasks(cv, data, direction)

  // Generate narrative note
  const noteLines: string[] = []
  noteLines.push(`Successful contact with ${cv.client.fullName}.`)
  noteLines.push('')
  if (data.treatmentStatus) noteLines.push(statusMap[data.treatmentStatus] || `Treatment: ${data.treatmentStatus}`)
  if (data.lastAppointmentDate) noteLines.push(`Last appointment: ${data.lastAppointmentDate}`)
  if (data.nextAppointmentStatus) noteLines.push(apptMap[data.nextAppointmentStatus] || `Next appt: ${data.nextAppointmentStatus}`)
  if (data.nextAppointmentDate) noteLines.push(`Next appointment date: ${data.nextAppointmentDate}`)
  if (data.symptomDirection) noteLines.push(symptomMap[data.symptomDirection] || `Symptoms: ${data.symptomDirection}`)
  if (data.symptomDetails) noteLines.push(`Details: ${data.symptomDetails}`)
  if (data.barrierType) noteLines.push(`Barrier: ${data.barrierType.replace(/_/g, ' ')}`)
  if (data.barrierDetails) noteLines.push(`Barrier detail: ${data.barrierDetails}`)
  if (data.progressionQuality) noteLines.push(`Progression: ${data.progressionQuality.replace(/_/g, ' ')}`)
  noteLines.push('')
  noteLines.push(`Assessment: ${DIRECTION_LABELS[direction.primaryDirection]}`)
  noteLines.push(`Confidence: ${direction.confidence}`)
  if (tasks.length > 0) {
    noteLines.push('')
    noteLines.push('Actions:')
    tasks.forEach(t => noteLines.push(`- ${t.description} (${t.urgency})`))
  }
  if (data.notes) {
    noteLines.push('')
    noteLines.push(`Notes: ${data.notes}`)
  }

  return {
    sessionId: '',
    whatWeLearned: {
      treatmentStatus: data.treatmentStatus ? statusMap[data.treatmentStatus] || data.treatmentStatus : 'Not captured',
      appointmentStatus: data.nextAppointmentStatus ? apptMap[data.nextAppointmentStatus] || data.nextAppointmentStatus : 'Not captured',
      symptomStatus: data.symptomDirection ? symptomMap[data.symptomDirection] || data.symptomDirection : 'Not captured',
      barrierStatus: data.barrierType ? data.barrierType.replace(/_/g, ' ') : 'No barrier identified',
      providerStatus: data.providerUpdates || 'No provider updates',
      engagementObservations: data.engagementLevel || 'Not assessed',
    },
    whatChanged,
    currentAssessment: direction,
    whatHappensNext: {
      tasks,
      followUpDate: data.followUpDate,
      escalationPath: data.escalationRecipient,
    },
    generatedNote: noteLines.join('\n'),
  }
}

// Auto-create tasks based on call data and rules (Spec 34)
export function generateAutoTasks(
  cv: FullCaseView,
  data: CapturedCallData,
  direction: DirectionalAssessment
): TaskItem[] {
  const tasks: TaskItem[] = []
  const caseId = cv.caseData.id

  // Provider follow-up if referral issues
  if (data.barrierType === 'provider_not_responsive' || data.barrierType === 'no_referral_followup') {
    tasks.push({
      type: 'provider_followup',
      description: 'Follow up with provider/referral office to resolve scheduling issue',
      owner: cv.caseData.caseManagerAssigned,
      urgency: 'high',
      contextNote: `Barrier: ${data.barrierType.replace(/_/g, ' ')}`,
      relatedCaseId: caseId,
    })
  }

  // Provider dissatisfaction → may need new referral
  if (data.barrierType === 'dissatisfied_with_provider') {
    tasks.push({
      type: 'provider_change',
      description: 'Evaluate need for alternative provider referral due to dissatisfaction',
      owner: cv.caseData.caseManagerAssigned,
      urgency: 'medium',
      relatedCaseId: caseId,
    })
  }

  // No next appointment + active symptoms → short follow-up
  if (data.nextAppointmentStatus === 'not_scheduled' && data.symptomDirection !== 'resolved') {
    tasks.push({
      type: 'client_followup',
      description: 'Recontact client in 48 hours to confirm appointment scheduling',
      owner: cv.caseData.caseManagerAssigned,
      urgency: 'high',
      relatedCaseId: caseId,
    })
  }

  // Worsening symptoms → escalate
  if (data.symptomDirection === 'worse') {
    tasks.push({
      type: 'escalation',
      description: 'Escalate worsening symptoms to medical management lead',
      owner: cv.caseData.medicalManagementLead || 'Medical Management Lead',
      urgency: 'high',
      contextNote: data.symptomDetails || 'Client reports worsening symptoms',
      relatedCaseId: caseId,
    })
  }

  // Direction-based tasks
  if (direction.primaryDirection === 'demand_readiness_review') {
    tasks.push({
      type: 'demand_review',
      description: 'Flag case for demand-readiness review',
      owner: cv.caseData.attorneyAssigned,
      urgency: 'medium',
      contextNote: direction.reasoning,
      relatedCaseId: caseId,
    })
  }

  if (direction.primaryDirection === 'litigation_review') {
    tasks.push({
      type: 'litigation_review',
      description: 'Flag case for litigation review',
      owner: cv.caseData.attorneyAssigned,
      urgency: 'high',
      contextNote: direction.reasoning,
      relatedCaseId: caseId,
    })
  }

  if (direction.primaryDirection === 'cut_review') {
    tasks.push({
      type: 'cut_review',
      description: 'Flag case for internal cut review',
      owner: cv.caseData.attorneyAssigned,
      urgency: 'medium',
      contextNote: direction.reasoning,
      relatedCaseId: caseId,
    })
  }

  if (direction.primaryDirection === 'transfer_review') {
    tasks.push({
      type: 'transfer_review',
      description: 'Flag case for transfer-out review',
      owner: cv.caseData.attorneyAssigned,
      urgency: 'medium',
      contextNote: direction.reasoning,
      relatedCaseId: caseId,
    })
  }

  // Transportation/logistics barrier → firm support
  if (data.barrierType === 'transportation' || data.barrierType === 'language_barrier') {
    tasks.push({
      type: 'support',
      description: `Arrange ${data.barrierType.replace(/_/g, ' ')} support for client`,
      owner: cv.caseData.caseManagerAssigned,
      urgency: 'medium',
      relatedCaseId: caseId,
    })
  }

  // Never started treatment → urgent engagement
  if (data.treatmentStatus === 'never_started') {
    tasks.push({
      type: 'urgent_engagement',
      description: 'Help client establish initial treatment — schedule first appointment',
      owner: cv.caseData.caseManagerAssigned,
      urgency: 'critical',
      relatedCaseId: caseId,
    })
  }

  return tasks
}
