// ============================================================
// Case Advancement Operating System — Core Type Definitions
// Maps to spec Sections 10, 12, 31, 36
// ============================================================

// --- Client Identity (Spec 10.1 / 12.1) ---
export interface Client {
  id: string
  fullName: string
  preferredName?: string
  pronunciationNote?: string
  phone: string
  altPhone?: string
  email?: string
  preferredContactMethod?: 'phone' | 'email' | 'text'
  primaryLanguage: string
  interpreterNeeded: boolean
  address?: string
  state: string
  dateOfBirth: string
  emergencyContact?: string
  workStatus?: string
}

// --- Case Identity (Spec 10.2 / 12.2) ---
export interface Case {
  id: string
  clientId: string
  matterId: string
  caseType: string
  accidentType: string
  dateOfIncident: string
  liabilitySummary?: string
  venue?: string
  attorneyAssigned: string
  caseManagerAssigned: string
  medicalManagementLead?: string
  retentionDate: string
  currentStage: CaseStage
  currentSubstage?: string
  statuteOfLimitationsDate: string
  transferRiskNote?: string
  cutRiskNote?: string
  specialHandlingFlags?: string[]
}

export type CaseStage =
  | 'early_case'
  | 'active_treatment'
  | 'mid_treatment'
  | 'late_treatment'
  | 'demand_prep'
  | 'litigation'
  | 'resolved'

// --- Treatment & Medical (Spec 10.3 / 12.3) ---
export interface TreatmentRecord {
  id: string
  caseId: string
  bodyPartsComplained: string[]
  knownInjuries: string[]
  symptomSummary: string
  treatmentStartDate?: string
  lastTreatmentDate?: string
  nextAppointmentDate?: string
  totalVisits?: number
  missedAppointments: number
  diagnosticsOrdered: string[]
  diagnosticsCompleted: string[]
  surgeryRecommendationStatus?: 'none' | 'recommended' | 'scheduled' | 'completed'
  injectionRecommendationStatus?: 'none' | 'recommended' | 'scheduled' | 'completed'
  erVisitHistory: boolean
  pcpInvolvement: boolean
  ptChiroStatus: ProviderStatus
  orthoStatus: ProviderStatus
  painManagementStatus: ProviderStatus
  neurologyStatus: ProviderStatus
  specialistStatus: ProviderStatus
  dischargeStatus: 'none' | 'partial' | 'full'
  plateauIndicator: boolean
}

export type ProviderStatus = 'not_referred' | 'referred' | 'active' | 'discharged' | 'inactive'

// --- Provider ---
export interface Provider {
  id: string
  caseId: string
  name: string
  type: 'chiropractor' | 'pt' | 'orthopedic' | 'pain_management' | 'neurology' | 'pcp' | 'er' | 'specialist' | 'other'
  status: ProviderStatus
  lastVisitDate?: string
  nextVisitDate?: string
  dissatisfactionNote?: string
}

// --- Referral ---
export interface Referral {
  id: string
  caseId: string
  providerType: string
  providerName?: string
  referralDate: string
  scheduledDate?: string
  status: 'pending' | 'scheduled' | 'completed' | 'failed' | 'cancelled'
  daysUnresolved?: number
}

// --- Operational Fields (Spec 10.4 / 12.4) ---
export interface OperationalData {
  caseId: string
  lastContactDate?: string
  lastSuccessfulContactDate?: string
  lastCallOutcome?: string
  nextFollowUpDate?: string
  outstandingTasks: number
  staleTasks: number
  noContactDays: number
  treatmentGapDays: number
  unresolvedReferralDays: number
  currentRiskFlags: string[]
  priorEscalations: string[]
  demandReadinessIndicator?: 'yes' | 'no' | 'unclear'
  litigationReviewIndicator?: 'yes' | 'no' | 'unclear'
  transferReviewIndicator?: 'yes' | 'no' | 'unclear'
  cutReviewIndicator?: 'yes' | 'no' | 'unclear'
}

// --- Scoring Model (Spec 10.5 / 31) ---
export interface CaseScores {
  treatmentContinuityScore: number    // 0-100
  symptomPersistenceScore: number     // 0-100
  barrierSeverityScore: number        // 0-100
  providerProgressionScore: number    // 0-100
  clientEngagementScore: number       // 0-100
  complianceScore: number             // 0-100
  demandTrajectoryScore: number       // 0-100
  urgencyScore: number                // 0-100
  caseWeaknessScore: number           // 0-100
  directionConfidenceScore: number    // 0-100
}

// --- Case Direction (Spec 20, 23) ---
export type CaseDirection =
  | 'continue_treatment_optimization'
  | 'closer_monitoring'
  | 'urgent_re_engagement'
  | 'next_level_care'
  | 'demand_readiness_review'
  | 'litigation_review'
  | 'cut_review'
  | 'transfer_review'
  | 'escalate_for_review'
  | 'unresolved'

export type DirectionConfidence = 'high' | 'moderate' | 'low'

export interface DirectionalAssessment {
  primaryDirection: CaseDirection
  confidence: DirectionConfidence
  reasoning: string
  secondaryDirections?: CaseDirection[]
}

// --- Call Session ---
export interface CallSession {
  id: string
  caseId: string
  clientId: string
  caseManagerName: string
  status: 'pre_call' | 'in_progress' | 'completed' | 'abandoned'
  currentNodeId: string
  currentStage: CallStage
  startedAt?: string
  completedAt?: string
  callOutcome?: CallOutcome
  // Data captured during call
  capturedData: CapturedCallData
  // Scores at end of call
  scores: Partial<CaseScores>
  // Direction assessment
  directionAssessment?: DirectionalAssessment
}

export type CallStage =
  | 'opening'
  | 'treatment_status'
  | 'symptoms'
  | 'appointments'
  | 'barriers'
  | 'progression'
  | 'direction'
  | 'next_step'
  | 'closeout'

export type CallOutcome =
  | 'successful_contact'
  | 'voicemail'
  | 'wrong_number'
  | 'language_barrier'
  | 'busy_reschedule'
  | 'unable_to_reach'

// --- Captured Call Data (Spec 13, 27) ---
export interface CapturedCallData {
  treatmentStatus?: TreatmentStatusAnswer
  lastAppointmentDate?: string
  nextAppointmentDate?: string
  nextAppointmentStatus?: AppointmentStatusAnswer
  symptomDirection?: SymptomAnswer
  symptomDetails?: string
  barrierType?: BarrierType
  barrierDetails?: string
  progressionQuality?: ProgressionAnswer
  providerUpdates?: string
  referralUpdates?: string
  engagementLevel?: 'engaged' | 'somewhat' | 'disengaged'
  clientEmotionalState?: ClientEmotionalState
  newMedicalEvents?: string
  directionAssessment?: CaseDirection
  bestNextAction?: string
  followUpDate?: string
  escalationFlag?: boolean
  escalationRecipient?: string
  notes?: string
  tasksCreated?: TaskItem[]
}

export type TreatmentStatusAnswer =
  | 'actively_treating'
  | 'stopped_treating'
  | 'never_started'
  | 'inconsistent'
  | 'unclear'
  | 'evasive'

export type AppointmentStatusAnswer =
  | 'scheduled'
  | 'not_scheduled'
  | 'waiting_callback'
  | 'referral_not_scheduled'
  | 'finished_no_next'
  | 'not_sure'

export type SymptomAnswer =
  | 'better'
  | 'worse'
  | 'same'
  | 'fluctuates'
  | 'hard_to_describe'
  | 'resolved'

export type ProgressionAnswer =
  | 'helping_a_lot'
  | 'helping_somewhat'
  | 'not_helping'
  | 'feels_stalled'
  | 'not_sure'
  | 'provider_discussed_next'
  | 'provider_not_discussed_next'

export type BarrierType =
  | 'work_schedule'
  | 'transportation'
  | 'childcare'
  | 'provider_too_far'
  | 'provider_not_responsive'
  | 'felt_better_stopped'
  | 'didnt_understand_next_step'
  | 'dissatisfied_with_provider'
  | 'nervous_anxious'
  | 'cost_concern'
  | 'insurance_confusion'
  | 'pain_with_treatment'
  | 'language_barrier'
  | 'life_stress_overwhelmed'
  | 'no_referral_followup'
  | 'other'

export type ClientEmotionalState =
  | 'calm'
  | 'angry'
  | 'overwhelmed'
  | 'passive'
  | 'minimizing'
  | 'fearful'
  | 'confused'
  | 'distrustful'
  | 'encouraged'
  | 'frustrated'

// --- Decision Tree Node (Spec 36) ---
export interface CallNode {
  nodeId: string
  nodeName: string
  stage: CallStage
  entryConditions?: EntryCondition[]
  promptText: string
  empathyGuidance: string
  purposeText: string
  answerOptions: AnswerOption[]
  followUpProbes: string[]
  fieldUpdates: FieldUpdate[]
  scoreUpdates: ScoreUpdate[]
  directionUpdates: DirectionUpdate[]
  taskRules: TaskRule[]
  escalationRules: EscalationRule[]
  requiredCompletionFlags: string[]
  nextNodeMap: Record<string, string> // answerId -> nodeId
}

export interface EntryCondition {
  field: string
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'exists' | 'not_exists'
  value?: string | number | boolean
}

export interface AnswerOption {
  id: string
  label: string
  description?: string
  emotionalContext?: string
}

export interface FieldUpdate {
  field: keyof CapturedCallData
  value: string | ((currentAnswer: string) => string)
}

export interface ScoreUpdate {
  score: keyof CaseScores
  adjustment: number // positive or negative
}

export interface DirectionUpdate {
  direction: CaseDirection
  weight: number // 0-1, how strongly this answer points to this direction
}

export interface TaskRule {
  condition: 'always' | 'if_answer' | 'if_field'
  answerIds?: string[]
  fieldCondition?: EntryCondition
  task: TaskItem
}

export interface EscalationRule {
  condition: 'always' | 'if_answer' | 'if_field'
  answerIds?: string[]
  recipient: string
  reason: string
  urgency: 'low' | 'medium' | 'high' | 'critical'
}

// --- Task (Spec 34) ---
export interface TaskItem {
  id?: string
  type: string
  description: string
  owner?: string
  dueDate?: string
  urgency: 'low' | 'medium' | 'high' | 'critical'
  contextNote?: string
  relatedCaseId?: string
  status?: 'pending' | 'completed'
}

// --- Post-Call Summary (Spec 33) ---
export interface PostCallSummary {
  sessionId: string
  whatWeLearned: {
    treatmentStatus: string
    appointmentStatus: string
    symptomStatus: string
    barrierStatus: string
    providerStatus: string
    engagementObservations: string
  }
  whatChanged: string[]
  currentAssessment: DirectionalAssessment
  whatHappensNext: {
    tasks: TaskItem[]
    followUpDate?: string
    escalationPath?: string
  }
  generatedNote: string
}

// --- Caseload Prioritization (Spec 11) ---
export type SortCriteria =
  | 'treatment_gap'
  | 'no_next_appointment'
  | 'worsening_symptoms'
  | 'unresolved_referral'
  | 'no_contact'
  | 'no_treatment_started'
  | 'statute_urgency'
  | 'demand_ready'
  | 'litigation_review'
  | 'cut_review'
  | 'transfer_review'
  | 'high_disengagement'
  | 'high_barrier'
  | 'missed_appointments'

// --- Full Case View (aggregated for screens) ---
export interface FullCaseView {
  client: Client
  caseData: Case
  treatment: TreatmentRecord
  providers: Provider[]
  referrals: Referral[]
  operational: OperationalData
  scores: CaseScores
  directionAssessment?: DirectionalAssessment
}

// --- Manager Dashboard (Spec 35) ---
export interface ManagerQueue {
  name: string
  description: string
  cases: FullCaseView[]
  count: number
}

export interface TeamMetrics {
  callsCompleted: number
  contactRate: number
  requiredFieldCompletionRate: number
  unresolvedCalls: number
  nextStepSecuredRate: number
  barrierIdentificationRate: number
  reEngagementSuccessRate: number
  promptUsageRate: number
}

// --- Timeline Event (Spec 15.4) ---
export interface TimelineEvent {
  date: string
  type: 'incident' | 'treatment_start' | 'appointment' | 'referral' | 'missed_appointment' | 'diagnostic' | 'contact' | 'gap' | 'milestone' | 'issue'
  title: string
  description?: string
  providerName?: string
  flagType?: 'warning' | 'info' | 'success' | 'danger'
}
