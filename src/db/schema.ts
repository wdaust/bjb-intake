/**
 * Drizzle schema — single source of truth for the Salesforce-mirror
 * tables and call-flow persistence.
 *
 * Mirrors the CREATE TABLE IF NOT EXISTS statements in `sync/schema.sql`,
 * which is applied by the sync worker on startup. Going forward, use
 * `drizzle-kit generate` to produce migrations from changes here and
 * stop relying on the ad-hoc `IF NOT EXISTS` DDL.
 *
 * **Client-side imports MUST be `import type`.** This file is the type
 * source for both the browser (which uses `$inferSelect` row types) and
 * the server-side Functions/sync worker (which will eventually use
 * Drizzle query builder). Only importing types erases the whole module
 * at compile time so no Drizzle runtime ships to the browser.
 */

import {
  pgTable,
  text,
  date,
  timestamp,
  boolean,
  integer,
  bigint,
  jsonb,
} from 'drizzle-orm/pg-core'

// ---------- Matters (cases) ----------

export const sfMatters = pgTable('sf_matters', {
  sfId: text('sf_id').primaryKey(),
  name: text('name'),
  displayName: text('display_name'),
  status: text('status'),
  caseType: text('case_type'),
  practiceArea: text('practice_area'),
  matterStage: text('matter_stage'),
  piStatus: text('pi_status'),
  matterState: text('matter_state'),
  clientId: text('client_id'),
  principalAttorneyId: text('principal_attorney_id'),
  originatingAttorneyId: text('originating_attorney_id'),
  openDate: date('open_date'),
  closeDate: date('close_date'),
  complaintFiledDate: date('complaint_filed_date'),
  incidentDate: date('incident_date'),
  retentionDate: date('retention_date'),
  statuteOfLimitations: date('statute_of_limitations'),
  venue: text('venue'),
  grossRecovery: bigint('gross_recovery', { mode: 'number' }),
  netRecovery: bigint('net_recovery', { mode: 'number' }),
  syncedAt: timestamp('synced_at', { withTimezone: true }).defaultNow(),
})

// ---------- Contacts (clients) ----------
//
// ⚠️ Join-key conventions (see sync/src/index.ts for details):
//   - `sf_id` is the Salesforce Contact Id (prefix 003...).
//   - `account_id` is the Contact's parent Account Id (prefix 001...).
//   - `sf_matters.client_id` holds `litify_pm__Client__c`, which is an
//     **Account Id**, not a Contact Id.
//
// Therefore the canonical join is:
//     sf_matters.client_id = sf_contacts.account_id
// NOT `= sf_contacts.sf_id` (that would compare 001-prefix to 003-prefix
// and always return NULL — previous bug in scripts/check-data.ts).
//
// Because an Account can own multiple Contacts, queries that join this
// table to matters MUST pick one row per matter (see the LATERAL joins
// in `functions/src/index.ts`) or they will multiply rows and the
// downstream `LIMIT N` will return fewer than N distinct matters.

export const sfContacts = pgTable('sf_contacts', {
  sfId: text('sf_id').primaryKey(),
  accountId: text('account_id'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  email: text('email'),
  phone: text('phone'),
  mobilePhone: text('mobile_phone'),
  mailingStreet: text('mailing_street'),
  mailingCity: text('mailing_city'),
  mailingState: text('mailing_state'),
  mailingPostalCode: text('mailing_postal_code'),
  birthdate: date('birthdate'),
  preferredLanguage: text('preferred_language'),
  syncedAt: timestamp('synced_at', { withTimezone: true }).defaultNow(),
})

// ---------- Users (attorneys, case managers, MMLs) ----------

export const sfUsers = pgTable('sf_users', {
  sfId: text('sf_id').primaryKey(),
  name: text('name'),
  email: text('email'),
  title: text('title'),
  department: text('department'),
  isActive: boolean('is_active'),
  attorneyType: text('attorney_type'),
  syncedAt: timestamp('synced_at', { withTimezone: true }).defaultNow(),
})

// ---------- Matter team members ----------

export const sfTeamMembers = pgTable('sf_team_members', {
  sfId: text('sf_id').primaryKey(),
  matterId: text('matter_id'),
  userId: text('user_id'),
  roleName: text('role_name'),
  syncedAt: timestamp('synced_at', { withTimezone: true }).defaultNow(),
})

// ---------- Injuries ----------

export const sfInjuries = pgTable('sf_injuries', {
  sfId: text('sf_id').primaryKey(),
  matterId: text('matter_id'),
  bodyPart: text('body_part'),
  areaAffected: text('area_affected'),
  diagnosis: text('diagnosis'),
  injuryDate: date('injury_date'),
  currentStatus: text('current_status'),
  isDiagnosed: boolean('is_diagnosed'),
  syncedAt: timestamp('synced_at', { withTimezone: true }).defaultNow(),
})

// ---------- Damages (treatment / provider records) ----------

export const sfDamages = pgTable('sf_damages', {
  sfId: text('sf_id').primaryKey(),
  matterId: text('matter_id'),
  providerName: text('provider_name'),
  type: text('type'),
  amountBilled: bigint('amount_billed', { mode: 'number' }),
  amountPaid: bigint('amount_paid', { mode: 'number' }),
  serviceStartDate: date('service_start_date'),
  serviceEndDate: date('service_end_date'),
  syncedAt: timestamp('synced_at', { withTimezone: true }).defaultNow(),
})

// ---------- Tasks (follow-ups, contact history) ----------

export const sfTasks = pgTable('sf_tasks', {
  sfId: text('sf_id').primaryKey(),
  subject: text('subject'),
  whatId: text('what_id'),
  whoId: text('who_id'),
  status: text('status'),
  priority: text('priority'),
  type: text('type'),
  activityDate: date('activity_date'),
  isClosed: boolean('is_closed'),
  completedDate: timestamp('completed_date', { withTimezone: true }),
  description: text('description'),
  matterId: text('matter_id'),
  ownerId: text('owner_id'),
  syncedAt: timestamp('synced_at', { withTimezone: true }).defaultNow(),
})

// ---------- Events (appointments, calls) ----------

export const sfEvents = pgTable('sf_events', {
  sfId: text('sf_id').primaryKey(),
  subject: text('subject'),
  whatId: text('what_id'),
  whoId: text('who_id'),
  type: text('type'),
  startDate: timestamp('start_date', { withTimezone: true }),
  endDate: timestamp('end_date', { withTimezone: true }),
  durationMinutes: integer('duration_minutes'),
  location: text('location'),
  isAllDay: boolean('is_all_day'),
  description: text('description'),
  matterId: text('matter_id'),
  syncedAt: timestamp('synced_at', { withTimezone: true }).defaultNow(),
})

// ---------- Matter stage activities ----------

export const sfStageActivities = pgTable('sf_stage_activities', {
  sfId: text('sf_id').primaryKey(),
  matterId: text('matter_id'),
  stageStatus: text('stage_status'),
  stageOrder: integer('stage_order'),
  daysStatusActive: integer('days_status_active'),
  dateStatusChanged: date('date_status_changed'),
  syncedAt: timestamp('synced_at', { withTimezone: true }).defaultNow(),
})

// ---------- Intakes ----------

export const sfIntakes = pgTable('sf_intakes', {
  sfId: text('sf_id').primaryKey(),
  name: text('name'),
  displayName: text('display_name'),
  status: text('status'),
  caseType: text('case_type'),
  clientId: text('client_id'),
  matterId: text('matter_id'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  email: text('email'),
  phone: text('phone'),
  incidentDate: date('incident_date'),
  openDate: date('open_date'),
  convertedDate: date('converted_date'),
  isConverted: boolean('is_converted'),
  qualified: boolean('qualified'),
  caseState: text('case_state'),
  practiceArea: text('practice_area'),
  syncedAt: timestamp('synced_at', { withTimezone: true }).defaultNow(),
})

// ---------- Call flow nodes (Flow Builder persistence) ----------

export const callFlowNodes = pgTable('call_flow_nodes', {
  nodeId: text('node_id').primaryKey(),
  nodeData: jsonb('node_data').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ---------- Inferred row types ----------
//
// These are what the rest of the codebase should use when touching row
// data. `SfMatterRow` is e.g. `{ sfId: string; name: string | null; ... }`
// — column nullability comes from whether the column has `.notNull()`.
//
// **Caveat:** since `liveData.ts` issues raw SQL with unaliased snake_case
// columns, use `SfMatterRowSnake` (below) for that code path. Migrate to
// Drizzle query builder to get the camelCase mapping for free.

export type SfMatter = typeof sfMatters.$inferSelect
export type SfContact = typeof sfContacts.$inferSelect
export type SfUser = typeof sfUsers.$inferSelect
export type SfTeamMember = typeof sfTeamMembers.$inferSelect
export type SfInjury = typeof sfInjuries.$inferSelect
export type SfDamage = typeof sfDamages.$inferSelect
export type SfTask = typeof sfTasks.$inferSelect
export type SfEvent = typeof sfEvents.$inferSelect
export type SfStageActivity = typeof sfStageActivities.$inferSelect
export type SfIntake = typeof sfIntakes.$inferSelect
export type CallFlowNode = typeof callFlowNodes.$inferSelect

// ---------- Snake-case row types for raw-SQL callers ----------
//
// Neon's tagged-template driver returns rows with the exact DB column
// names (snake_case). These types mirror the `$inferSelect` types above
// but key by DB column name, so `liveData.ts`'s mapper can consume them
// directly without `Record<string, unknown>` casts.

export interface SfMatterRow {
  sf_id: string
  name: string | null
  display_name: string | null
  status: string | null
  case_type: string | null
  practice_area: string | null
  matter_stage: string | null
  pi_status: string | null
  matter_state: string | null
  client_id: string | null
  principal_attorney_id: string | null
  originating_attorney_id: string | null
  open_date: string | null
  close_date: string | null
  complaint_filed_date: string | null
  incident_date: string | null
  retention_date: string | null
  statute_of_limitations: string | null
  venue: string | null
  gross_recovery: number | null
  net_recovery: number | null
  // Extra columns from the joined SELECTs used in liveData.ts:
  matter_id?: string | null // alias for m.name
  client_first?: string | null
  client_last?: string | null
  client_phone?: string | null
  client_email?: string | null
  client_state?: string | null
  client_dob?: string | null
  mailing_street?: string | null
  mailing_city?: string | null
  attorney_name?: string | null
}

export interface SfContactRow {
  sf_id: string
  account_id: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  mobile_phone: string | null
  mailing_street: string | null
  mailing_city: string | null
  mailing_state: string | null
  mailing_postal_code: string | null
  birthdate: string | null
  preferred_language: string | null
}

export interface SfTeamMemberRow {
  sf_id: string
  matter_id: string | null
  user_id: string | null
  role_name: string | null
  // Join-augmented column from `LEFT JOIN sf_users u`:
  user_name?: string | null
}

export interface SfInjuryRow {
  sf_id: string
  matter_id: string | null
  body_part: string | null
  area_affected: string | null
  diagnosis: string | null
  injury_date: string | null
  current_status: string | null
  is_diagnosed: boolean | null
}

export interface SfDamageRow {
  sf_id: string
  matter_id: string | null
  provider_name: string | null
  type: string | null
  amount_billed: number | null
  amount_paid: number | null
  service_start_date: string | null
  service_end_date: string | null
}

export interface SfTaskRow {
  sf_id: string
  subject: string | null
  what_id: string | null
  who_id: string | null
  status: string | null
  priority: string | null
  type: string | null
  activity_date: string | null
  is_closed: boolean | null
  completed_date: string | null
  description: string | null
  matter_id: string | null
  owner_id: string | null
}

export interface SfEventRow {
  sf_id: string
  subject: string | null
  what_id: string | null
  who_id: string | null
  type: string | null
  start_date: string | null
  end_date: string | null
  duration_minutes: number | null
  location: string | null
  is_all_day: boolean | null
  description: string | null
  matter_id: string | null
}

export interface CallFlowNodeRow {
  node_id: string
  node_data: unknown // typed as CallNode at the app layer
  updated_at: string | null
}

// ============================================================================
// CAOS-owned tables (intake + call scoring + treatment progression)
// ============================================================================
// These are source-of-truth in Neon, NOT mirrored from Litify.
// The `leads` table precedes matter creation; on engagement-agreement
// signature the lead converts to a matter and data cross-links via
// `leads.converted_matter_id`.

// ---------- Leads (pre-retention intake prospects) ----------

export const leads = pgTable('leads', {
  id: text('id').primaryKey(),                    // INT-260424...
  name: text('name').notNull(),
  phone: text('phone'),
  email: text('email'),
  state: text('state').notNull(),                 // 2-letter
  caseType: text('case_type'),                    // MVA, Slip and Fall, …
  source: text('source'),                         // phone, web, referral, partner
  intakeDate: timestamp('intake_date', { withTimezone: true }).defaultNow(),
  slaDeadline: timestamp('sla_deadline', { withTimezone: true }),
  status: text('status').notNull().default('new'),
  // new | contacted | qualifying | agreement_sent | signed | rejected | refer_out
  verdict: text('verdict'),                       // one of 17 v8 categories
  valueTier: text('value_tier'),                  // CATASTROPHIC|HIGH|MEDIUM|LOW|MINIMAL
  opportunityScore: integer('opportunity_score'), // 0-100
  estValueRange: text('est_value_range'),         // '$40K-$150K'
  assignedTo: text('assigned_to'),                // intake specialist sf_user_id
  // Captured intake facts (denormalized for speed — AI-extracted from call)
  incidentDate: date('incident_date'),
  incidentState: text('incident_state'),
  incidentVenue: text('incident_venue'),
  incidentNarrative: text('incident_narrative'),
  erVisit: boolean('er_visit'),
  erFacility: text('er_facility'),
  policeReport: text('police_report'),
  witnesses: jsonb('witnesses'),                  // [{name, phone}]
  defendantDescription: text('defendant_description'),
  commercialDefendant: boolean('commercial_defendant'),
  clientInsurance: text('client_insurance'),
  clientPipBool: boolean('client_pip_bool'),
  priorRepresentation: boolean('prior_representation'),
  convertedMatterId: text('converted_matter_id'), // FK sf_matters.sf_id after signing
  convertedAt: timestamp('converted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ---------- Calls (audio + metadata) ----------
// Both intake calls and CM follow-up calls live here.

export const calls = pgTable('calls', {
  id: text('id').primaryKey(),                    // call-<uuid>
  callType: text('call_type').notNull(),          // 'intake' | 'cm_call'
  leadId: text('lead_id'),                        // FK leads.id for intake
  matterId: text('matter_id'),                    // FK sf_matters.sf_id for cm_call
  cmUserId: text('cm_user_id'),                   // who was on the call (CM or IS)
  clientName: text('client_name'),
  clientPhone: text('client_phone'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  durationSec: integer('duration_sec'),
  audioFileRef: text('audio_file_ref'),           // Firebase Storage path
  audioFileHash: text('audio_file_hash'),
  status: text('status').notNull().default('uploaded'),
  // uploaded | transcribing | transcribed | scoring | scored | failed
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ---------- Call transcripts (diarized) ----------

export const callTranscripts = pgTable('call_transcripts', {
  id: text('id').primaryKey(),
  callId: text('call_id').notNull(),              // FK calls.id
  provider: text('provider').notNull(),           // 'whisper' | 'assemblyai'
  segments: jsonb('segments').notNull(),          // [{speaker, start, end, text}]
  fullText: text('full_text'),                    // concatenated for prompt input
  language: text('language').default('en'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ---------- Call scores ----------
// Stores the Claude scoring output verbatim. Shape differs by call_type
// but we keep one table; `scores` jsonb holds the full validated payload.

export const callScores = pgTable('call_scores', {
  id: text('id').primaryKey(),
  callId: text('call_id').notNull(),              // FK calls.id
  callType: text('call_type').notNull(),          // denormalized
  rubricVersion: text('rubric_version').notNull(),// 'intake-v8' | 'cm-v1'
  // For intake calls:
  verdict: text('verdict'),                       // one of 17
  valueTier: text('value_tier'),
  opportunityScore: integer('opportunity_score'),
  confidence: text('confidence'),
  // For CM calls:
  overallScore: integer('overall_score'),
  // Both:
  scores: jsonb('scores').notNull(),              // full JSON per rubric
  rawLlmOutput: jsonb('raw_llm_output'),          // kept for audit
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

// ---------- Injuries (per-body-region) ----------

export const injuries = pgTable('injuries', {
  id: text('id').primaryKey(),
  matterId: text('matter_id'),                    // FK sf_matters.sf_id
  leadId: text('lead_id'),                        // FK leads.id (pre-retention)
  bodyRegion: text('body_region').notNull(),
  severity: text('severity'),                     // minor|moderate|severe|catastrophic
  erAdmitted: boolean('er_admitted'),
  erFacility: text('er_facility'),
  icd10Codes: text('icd10_codes').array(),
  currentPhase: text('current_phase').default('conservative'),
  // conservative | imaging | pain_mgmt | surgical | mmi | litigation_ready
  nextAction: text('next_action'),
  mmiDate: date('mmi_date'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ---------- Treatment events (per-modality per-injury) ----------

export const treatmentEvents = pgTable('treatment_events', {
  id: text('id').primaryKey(),
  injuryId: text('injury_id').notNull(),          // FK injuries.id
  matterId: text('matter_id'),                    // denormalized for query perf
  modality: text('modality').notNull(),
  status: text('status').notNull().default('recommended'),
  providerName: text('provider_name'),
  scheduledDate: date('scheduled_date'),
  completedDate: date('completed_date'),
  outcome: text('outcome'),
  outcomeNotes: text('outcome_notes'),
  findings: jsonb('findings'),                    // { herniation: 'L4-L5', ... }
  declineReason: text('decline_reason'),
  dependsOn: text('depends_on').array(),          // [treatment_event_id]
  litifyDamageId: text('litify_damage_id'),       // back-ref to sf_damages.sf_id
  autoExtractedFromCallId: text('auto_extracted_from_call_id'),
  autoExtractedConfidence: text('auto_extracted_confidence'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ---------- Engagement agreements ----------

export const engagementAgreements = pgTable('engagement_agreements', {
  id: text('id').primaryKey(),
  leadId: text('lead_id').notNull(),
  templateVersion: text('template_version').notNull(),
  provider: text('provider').default('dropbox_sign'),
  providerEnvelopeId: text('provider_envelope_id'),
  status: text('status').notNull().default('draft'),
  // draft | sent | viewed | signed | voided | expired
  sentAt: timestamp('sent_at', { withTimezone: true }),
  viewedAt: timestamp('viewed_at', { withTimezone: true }),
  signedAt: timestamp('signed_at', { withTimezone: true }),
  voidedAt: timestamp('voided_at', { withTimezone: true }),
  signerIp: text('signer_ip'),
  signerEmail: text('signer_email'),
  signerPhone: text('signer_phone'),
  signedPdfStorageKey: text('signed_pdf_storage_key'),
  auditTrailStorageKey: text('audit_trail_storage_key'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ---------- Appointments (intake → CM handoff + ongoing) ----------

export const appointments = pgTable('appointments', {
  id: text('id').primaryKey(),
  leadId: text('lead_id'),                        // FK leads.id for intro calls
  matterId: text('matter_id'),                    // FK sf_matters.sf_id once converted
  cmUserId: text('cm_user_id').notNull(),         // who the appt is with
  scheduledTs: timestamp('scheduled_ts', { withTimezone: true }).notNull(),
  durationMin: integer('duration_min').default(30),
  kind: text('kind').default('intro_call'),
  // intro_call | check_in | treatment_coord | demand_prep | other
  status: text('status').notNull().default('pending'),
  // pending | confirmed | declined | completed | no_show | rescheduled | cancelled
  remindersEnabled: boolean('reminders_enabled').default(true),
  reminderLog: jsonb('reminder_log'),
  // [{ offsetMin: 30, channel: 'sms'|'email', sentAt, delivered }]
  calendarEventId: text('calendar_event_id'),     // Google or Outlook event id
  calendarProvider: text('calendar_provider'),    // 'google' | 'outlook' | 'ics'
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

// ---------- Inferred row types ----------

export type Lead = typeof leads.$inferSelect
export type Call = typeof calls.$inferSelect
export type CallTranscript = typeof callTranscripts.$inferSelect
export type CallScore = typeof callScores.$inferSelect
export type Injury = typeof injuries.$inferSelect
export type TreatmentEvent = typeof treatmentEvents.$inferSelect
export type EngagementAgreement = typeof engagementAgreements.$inferSelect
export type Appointment = typeof appointments.$inferSelect
