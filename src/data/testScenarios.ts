import type { FullCaseView, Client, Case, TreatmentRecord, OperationalData, CaseScores } from '@/types'

export interface TestScenario {
  id: string
  name: string
  description: string
  expectedPath: string
  expectedDirection: string
  caseData: FullCaseView
  expectedAnswers: { nodeId: string; answerId: string; explanation: string }[]
}

function makeScores(overrides: Partial<CaseScores>): CaseScores {
  return {
    treatmentContinuityScore: 50, symptomPersistenceScore: 50, barrierSeverityScore: 20,
    providerProgressionScore: 50, clientEngagementScore: 50, complianceScore: 50,
    demandTrajectoryScore: 30, urgencyScore: 30, caseWeaknessScore: 20, directionConfidenceScore: 50,
    ...overrides,
  }
}

const baseClient: Client = {
  id: 'test-client', fullName: 'Test Client', preferredName: 'Test',
  phone: '(555) 000-0000', primaryLanguage: 'English', interpreterNeeded: false,
  state: 'NJ', dateOfBirth: '1985-06-15',
}

const baseCase: Case = {
  id: 'test-case', clientId: 'test-client', matterId: 'TEST-001',
  caseType: 'Personal Injury', accidentType: 'Motor Vehicle Accident',
  dateOfIncident: '2025-08-01', attorneyAssigned: 'Test Attorney',
  caseManagerAssigned: 'Test CM', retentionDate: '2025-08-10',
  currentStage: 'active_treatment', statuteOfLimitationsDate: '2027-08-01',
}

const baseTreatment: TreatmentRecord = {
  id: 'test-treat', caseId: 'test-case', bodyPartsComplained: ['Cervical spine', 'Lumbar spine'],
  knownInjuries: ['Cervical strain', 'Lumbar strain'], symptomSummary: 'Neck and back pain.',
  treatmentStartDate: '2025-08-15', totalVisits: 10, missedAppointments: 0,
  diagnosticsOrdered: ['MRI'], diagnosticsCompleted: ['MRI'],
  surgeryRecommendationStatus: 'none', injectionRecommendationStatus: 'none',
  erVisitHistory: false, pcpInvolvement: true, ptChiroStatus: 'active',
  orthoStatus: 'not_referred', painManagementStatus: 'not_referred',
  neurologyStatus: 'not_referred', specialistStatus: 'not_referred',
  dischargeStatus: 'none', plateauIndicator: false,
}

const baseOps: OperationalData = {
  caseId: 'test-case', outstandingTasks: 0, staleTasks: 0,
  noContactDays: 7, treatmentGapDays: 7, unresolvedReferralDays: 0,
  currentRiskFlags: [], priorEscalations: [],
}

export const testScenarios: TestScenario[] = [
  {
    id: 'active-improving',
    name: 'Active Treatment — Improving (Demand Path)',
    description: 'Client is actively treating, symptoms improving, treatment helping. May be approaching demand readiness.',
    expectedPath: 'Opening → Treatment Status (active) → Symptoms (better) → Appointments (scheduled) → Progression (helping) → Direction (demand check) → Close',
    expectedDirection: 'Demand Readiness Review',
    caseData: {
      client: { ...baseClient, fullName: 'Maria Test-Gonzalez', preferredName: 'Maria' },
      caseData: { ...baseCase, id: 'test-active-improving', currentStage: 'late_treatment' },
      treatment: { ...baseTreatment, caseId: 'test-active-improving', lastTreatmentDate: '2026-04-10', nextAppointmentDate: '2026-04-22', totalVisits: 35, dischargeStatus: 'partial', ptChiroStatus: 'discharged', orthoStatus: 'active' },
      providers: [{ id: 'p1', caseId: 'test-active-improving', name: 'Dr. Walsh Ortho', type: 'orthopedic', status: 'active' }],
      referrals: [],
      operational: { ...baseOps, caseId: 'test-active-improving', treatmentGapDays: 6, noContactDays: 5, lastContactDate: '2026-04-11', lastSuccessfulContactDate: '2026-04-11' },
      scores: makeScores({ treatmentContinuityScore: 85, symptomPersistenceScore: 25, demandTrajectoryScore: 78, clientEngagementScore: 90, urgencyScore: 15 }),
    },
    expectedAnswers: [
      { nodeId: 'opening_greeting', answerId: 'client_available', explanation: 'Client is available and willing to talk' },
      { nodeId: 'treatment_status_main', answerId: 'actively_treating', explanation: 'Client confirms active treatment' },
      { nodeId: 'symptoms_main', answerId: 'better', explanation: 'Client reports improvement' },
      { nodeId: 'appointments_last', answerId: 'within_two_weeks', explanation: 'Recent appointment' },
      { nodeId: 'appointments_next', answerId: 'scheduled', explanation: 'Has next appointment' },
      { nodeId: 'progression_main', answerId: 'helping_a_lot', explanation: 'Treatment is effective' },
      { nodeId: 'direction_demand_check', answerId: 'no_more_expected', explanation: 'Provider says treatment stable' },
      { nodeId: 'next_step_secure', answerId: 'specific_appointment', explanation: 'Has specific next appointment' },
      { nodeId: 'closeout_summary', answerId: 'all_good', explanation: 'Clean close' },
    ],
  },
  {
    id: 'stopped-stalled',
    name: 'Stopped Treatment — Stalled (Re-engagement Path)',
    description: 'Client stopped treating, symptoms still active, no next appointment. Needs barrier identification and re-engagement.',
    expectedPath: 'Opening → Treatment (stopped) → Symptoms (same) → Appointments (none) → Barriers (work) → Barrier resolve → Close',
    expectedDirection: 'Urgent Re-Engagement',
    caseData: {
      client: { ...baseClient, fullName: 'James Test-Thompson', preferredName: 'James' },
      caseData: { ...baseCase, id: 'test-stopped-stalled', currentStage: 'mid_treatment', cutRiskNote: 'Declining engagement' },
      treatment: { ...baseTreatment, caseId: 'test-stopped-stalled', lastTreatmentDate: '2026-03-15', totalVisits: 12, missedAppointments: 4, plateauIndicator: true },
      providers: [{ id: 'p1', caseId: 'test-stopped-stalled', name: 'Jersey City PT', type: 'pt', status: 'inactive' }],
      referrals: [{ id: 'r1', caseId: 'test-stopped-stalled', providerType: 'orthopedic', referralDate: '2026-03-20', status: 'pending', daysUnresolved: 27 }],
      operational: { ...baseOps, caseId: 'test-stopped-stalled', treatmentGapDays: 32, noContactDays: 22, unresolvedReferralDays: 27, currentRiskFlags: ['treatment_gap', 'unresolved_referral', 'disengagement_risk'] },
      scores: makeScores({ treatmentContinuityScore: 20, clientEngagementScore: 30, urgencyScore: 80, caseWeaknessScore: 65 }),
    },
    expectedAnswers: [
      { nodeId: 'opening_greeting', answerId: 'client_available', explanation: 'Client available' },
      { nodeId: 'treatment_status_main', answerId: 'stopped_treating', explanation: 'Client confirms stopped' },
      { nodeId: 'symptoms_main', answerId: 'same', explanation: 'Symptoms unchanged' },
      { nodeId: 'appointments_last', answerId: 'over_month', explanation: 'Over a month ago' },
      { nodeId: 'appointments_next', answerId: 'not_scheduled', explanation: 'Nothing scheduled → triggers barriers' },
      { nodeId: 'barriers_main', answerId: 'work_schedule', explanation: 'Work schedule is the barrier' },
      { nodeId: 'barriers_resolve', answerId: 'accepts_help', explanation: 'Willing to accept help' },
      { nodeId: 'progression_main', answerId: 'feels_stalled', explanation: 'Treatment felt stalled' },
      { nodeId: 'direction_assessment', answerId: 'continuing_treatment', explanation: 'Wants to continue' },
      { nodeId: 'next_step_secure', answerId: 'firm_will_help', explanation: 'CM will help schedule' },
      { nodeId: 'closeout_summary', answerId: 'all_good', explanation: 'Close' },
    ],
  },
  {
    id: 'never-started',
    name: 'Never Started Treatment (Cut Risk Path)',
    description: 'Client never began treatment, worsening symptoms, high disengagement. May need cut review.',
    expectedPath: 'Opening → Treatment (never) → Symptoms (worse) → Appointments (none) → Barriers → Direction → Close',
    expectedDirection: 'Cut Review or Urgent Re-Engagement',
    caseData: {
      client: { ...baseClient, fullName: 'Robert Test-Williams', preferredName: 'Rob' },
      caseData: { ...baseCase, id: 'test-never-started', currentStage: 'early_case' },
      treatment: { ...baseTreatment, caseId: 'test-never-started', lastTreatmentDate: undefined, treatmentStartDate: undefined, totalVisits: 0 },
      providers: [],
      referrals: [{ id: 'r1', caseId: 'test-never-started', providerType: 'orthopedic', referralDate: '2026-02-01', status: 'failed', daysUnresolved: 74 }],
      operational: { ...baseOps, caseId: 'test-never-started', treatmentGapDays: 999, noContactDays: 40, unresolvedReferralDays: 74, currentRiskFlags: ['no_treatment', 'no_contact', 'disengagement_risk'] },
      scores: makeScores({ treatmentContinuityScore: 5, clientEngagementScore: 10, urgencyScore: 95, caseWeaknessScore: 90, directionConfidenceScore: 20 }),
    },
    expectedAnswers: [
      { nodeId: 'opening_greeting', answerId: 'client_available', explanation: 'Client available' },
      { nodeId: 'treatment_status_main', answerId: 'never_started', explanation: 'Never started treatment' },
      { nodeId: 'symptoms_main', answerId: 'worse', explanation: 'Symptoms worsening' },
      { nodeId: 'symptoms_worse_detail', answerId: 'same_areas_worse', explanation: 'Same areas getting worse' },
      { nodeId: 'appointments_last', answerId: 'dont_remember', explanation: 'No appointments to recall' },
      { nodeId: 'appointments_next', answerId: 'not_scheduled', explanation: 'Nothing scheduled' },
      { nodeId: 'barriers_main', answerId: 'no_referral_followup', explanation: 'Nobody followed up on referral' },
      { nodeId: 'barriers_resolve', answerId: 'accepts_help', explanation: 'Willing to accept help' },
    ],
  },
  {
    id: 'angry-client',
    name: 'Angry Client at Opening (De-escalation Path)',
    description: 'Client is immediately upset/angry. Tests de-escalation flow and empathy coaching.',
    expectedPath: 'Opening (upset) → De-escalation → Treatment Status → Continue normal flow',
    expectedDirection: 'Depends on underlying case facts',
    caseData: {
      client: { ...baseClient, fullName: 'Angry Test-Client', preferredName: 'Alex' },
      caseData: { ...baseCase, id: 'test-angry' },
      treatment: { ...baseTreatment, caseId: 'test-angry' },
      providers: [],
      referrals: [],
      operational: { ...baseOps, caseId: 'test-angry' },
      scores: makeScores({}),
    },
    expectedAnswers: [
      { nodeId: 'opening_greeting', answerId: 'client_upset', explanation: 'Client is upset immediately' },
      { nodeId: 'difficult_angry_opening', answerId: 'calming_down', explanation: 'Client calms after validation' },
      { nodeId: 'treatment_status_main', answerId: 'actively_treating', explanation: 'Proceeds to normal flow' },
    ],
  },
  {
    id: 'overwhelmed-barriers',
    name: 'Overwhelmed Client with Barriers (Emotional Support Path)',
    description: 'Client is overwhelmed by life stress, inconsistent treatment. Tests emotional barrier handling.',
    expectedPath: 'Opening → Treatment (inconsistent) → Symptoms (fluctuates) → Appointments (none) → Barriers (overwhelmed) → Emotional support → Close',
    expectedDirection: 'Closer Monitoring',
    caseData: {
      client: { ...baseClient, fullName: 'Overwhelmed Test-Client', preferredName: 'Sam' },
      caseData: { ...baseCase, id: 'test-overwhelmed' },
      treatment: { ...baseTreatment, caseId: 'test-overwhelmed', missedAppointments: 3 },
      providers: [],
      referrals: [],
      operational: { ...baseOps, caseId: 'test-overwhelmed', treatmentGapDays: 18, currentRiskFlags: ['treatment_gap', 'missed_appointments'] },
      scores: makeScores({ barrierSeverityScore: 70, clientEngagementScore: 35, complianceScore: 30 }),
    },
    expectedAnswers: [
      { nodeId: 'opening_greeting', answerId: 'client_available', explanation: 'Client available' },
      { nodeId: 'treatment_status_main', answerId: 'inconsistent', explanation: 'On and off treatment' },
      { nodeId: 'symptoms_main', answerId: 'fluctuates', explanation: 'Symptoms up and down' },
      { nodeId: 'appointments_last', answerId: 'few_weeks', explanation: 'A few weeks ago' },
      { nodeId: 'appointments_next', answerId: 'not_scheduled', explanation: 'Nothing scheduled' },
      { nodeId: 'barriers_main', answerId: 'life_stress_overwhelmed', explanation: 'Life stress is the barrier' },
      { nodeId: 'barriers_resolve_emotional', answerId: 'willing_small_step', explanation: 'Willing to take a small step' },
    ],
  },
  {
    id: 'voicemail',
    name: 'Voicemail — No Contact',
    description: 'Call goes to voicemail. Tests non-contact outcome and task creation.',
    expectedPath: 'Opening → Voicemail → Complete',
    expectedDirection: 'N/A — no contact',
    caseData: {
      client: { ...baseClient, fullName: 'Voicemail Test-Client', preferredName: 'VM' },
      caseData: { ...baseCase, id: 'test-voicemail' },
      treatment: { ...baseTreatment, caseId: 'test-voicemail' },
      providers: [],
      referrals: [],
      operational: { ...baseOps, caseId: 'test-voicemail' },
      scores: makeScores({}),
    },
    expectedAnswers: [
      { nodeId: 'opening_greeting', answerId: 'voicemail', explanation: 'Call went to voicemail' },
      { nodeId: 'non_contact_voicemail', answerId: 'voicemail_left', explanation: 'Left voicemail' },
    ],
  },
  {
    id: 'provider-dissatisfied',
    name: 'Provider Dissatisfaction (Provider Change Path)',
    description: 'Client stopped treating because they are unhappy with their provider. Tests provider dissatisfaction flow.',
    expectedPath: 'Opening → Treatment (stopped) → Symptoms (same) → Appointments (none) → Barriers (dissatisfied) → Provider change → Close',
    expectedDirection: 'Continue Treatment Optimization',
    caseData: {
      client: { ...baseClient, fullName: 'Dissatisfied Test-Client', preferredName: 'Pat' },
      caseData: { ...baseCase, id: 'test-dissatisfied' },
      treatment: { ...baseTreatment, caseId: 'test-dissatisfied', lastTreatmentDate: '2026-03-20' },
      providers: [{ id: 'p1', caseId: 'test-dissatisfied', name: 'Bad Provider', type: 'pt', status: 'inactive', dissatisfactionNote: 'Client unhappy' }],
      referrals: [],
      operational: { ...baseOps, caseId: 'test-dissatisfied', treatmentGapDays: 27 },
      scores: makeScores({ providerProgressionScore: 25, barrierSeverityScore: 55 }),
    },
    expectedAnswers: [
      { nodeId: 'opening_greeting', answerId: 'client_available', explanation: 'Client available' },
      { nodeId: 'treatment_status_main', answerId: 'stopped_treating', explanation: 'Stopped treating' },
      { nodeId: 'symptoms_main', answerId: 'same', explanation: 'Symptoms unchanged' },
      { nodeId: 'appointments_last', answerId: 'few_weeks', explanation: 'A few weeks ago' },
      { nodeId: 'appointments_next', answerId: 'not_scheduled', explanation: 'Nothing scheduled' },
      { nodeId: 'barriers_main', answerId: 'dissatisfied_with_provider', explanation: 'Unhappy with provider' },
      { nodeId: 'barriers_provider_dissatisfaction', answerId: 'wants_new_provider', explanation: 'Wants a different provider' },
    ],
  },
]

export function getScenario(id: string): TestScenario | undefined {
  return testScenarios.find(s => s.id === id)
}
