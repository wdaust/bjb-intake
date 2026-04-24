/**
 * Seed the Maria Santos demo data:
 *   - Lead (PURSUE-HARD, NJ MVA, $75K-$250K)
 *   - 2 calls (intake + CM follow-up) with references to the generated MP3s
 *   - 3 injuries (cervical, lumbar, shoulder_r)
 *   - Seeded treatment events showing the Kanban progression
 *   - One appointment (Jess ← Maria intro call, Monday 11am)
 *   - One engagement agreement (signed)
 *
 * Run: node scripts/seed-maria.mjs
 */
import { readFileSync } from 'node:fs'
import pg from 'pg'

const url = readFileSync('/Users/daustmac/Documents/bjb-intake/.env', 'utf8')
  .match(/^DATABASE_URL=(.+)$/m)[1].trim()

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
})

await client.connect()

// --- IDs we'll reference across rows ---
const LEAD_ID  = 'INT-260424-maria'
const INTAKE_CALL_ID = 'call-intake-maria'
const CM_CALL_ID     = 'call-cm-maria'
const INJ_CERVICAL = 'inj-maria-cervical'
const INJ_LUMBAR   = 'inj-maria-lumbar'
const INJ_SHOULDER = 'inj-maria-shoulder-r'
const APPT_ID = 'appt-maria-intro'
const AGREEMENT_ID = 'agr-maria'

// Order matters: delete children first, then parents.
await client.query(`DELETE FROM treatment_events WHERE injury_id LIKE 'inj-maria-%'`)
await client.query(`DELETE FROM injuries WHERE id LIKE 'inj-maria-%'`)
await client.query(`DELETE FROM call_scores WHERE call_id IN ('${INTAKE_CALL_ID}', '${CM_CALL_ID}')`)
await client.query(`DELETE FROM call_transcripts WHERE call_id IN ('${INTAKE_CALL_ID}', '${CM_CALL_ID}')`)
await client.query(`DELETE FROM calls WHERE id IN ('${INTAKE_CALL_ID}', '${CM_CALL_ID}')`)
await client.query(`DELETE FROM appointments WHERE id = '${APPT_ID}'`)
await client.query(`DELETE FROM engagement_agreements WHERE id = '${AGREEMENT_ID}'`)
await client.query(`DELETE FROM leads WHERE id = '${LEAD_ID}'`)

// --- Lead ---
await client.query(
  `INSERT INTO leads (
    id, name, phone, email, state, case_type, source,
    intake_date, sla_deadline, status,
    verdict, value_tier, opportunity_score, est_value_range,
    assigned_to, incident_date, incident_state, incident_venue,
    incident_narrative, er_visit, er_facility, police_report,
    witnesses, defendant_description, commercial_defendant,
    client_insurance, client_pip_bool, prior_representation
  ) VALUES (
    $1, 'Maria Santos', '8622535625', 'maria.santos@example.com', 'NJ', 'MVA', 'phone',
    now() - interval '18 hours',
    now() + interval '4 minutes',
    'qualifying',
    'PURSUE - HARD', 'HIGH', 88, '$75K-$250K',
    'mark.intake',
    $2, 'NJ', 'I-95 NJ Turnpike near exit 11',
    'Stopped in traffic, rear-ended by Fortis Contracting work truck. Defendant admitted being on phone.',
    true, 'Robert Wood Johnson',
    'NJ-SP-2026-0482-A',
    $3::jsonb,
    'Fortis Contracting work truck with ladder rack',
    true,
    'GEICO', true, false
  )`,
  [LEAD_ID, '2026-04-15', JSON.stringify([{ name: 'Witness in car ahead', phone: '(to be provided)' }])]
)

// --- Engagement agreement (sent + signed) ---
await client.query(
  `INSERT INTO engagement_agreements (
    id, lead_id, template_version, provider, status,
    sent_at, viewed_at, signed_at, signer_email, signer_phone
  ) VALUES (
    $1, $2, 'bjb-retainer-v3', 'dropbox_sign', 'signed',
    now() - interval '17 hours',
    now() - interval '16 hours 45 minutes',
    now() - interval '16 hours',
    'maria.santos@example.com', '8622535625'
  )`,
  [AGREEMENT_ID, LEAD_ID]
)

// --- Appointment (Jess intro, Monday 11am next week) ---
await client.query(
  `INSERT INTO appointments (
    id, lead_id, cm_user_id, scheduled_ts, duration_min, kind, status,
    reminders_enabled, notes
  ) VALUES (
    $1, $2, '005Pp000002WJxdIAG',
    date_trunc('week', now()) + interval '7 days' + interval '11 hours',
    30, 'intro_call', 'confirmed',
    true,
    'Mark qualified PURSUE-HARD. Primary focus: PT schedule + MRI urgency.'
  )`,
  [APPT_ID, LEAD_ID]
)

// --- Intake call (Mark + Maria) ---
await client.query(
  `INSERT INTO calls (
    id, call_type, lead_id, cm_user_id,
    client_name, client_phone,
    started_at, ended_at, duration_sec,
    audio_file_ref, status
  ) VALUES (
    $1, 'intake', $2, 'mark.intake',
    'Maria Santos', '8622535625',
    now() - interval '17 hours 45 minutes',
    now() - interval '17 hours 42 minutes',
    165,
    '/demo/audio/maria_intake_call1.mp3',
    'scored'
  )`,
  [INTAKE_CALL_ID, LEAD_ID]
)

// --- CM call (Jess + Maria) — demo's second audio ---
await client.query(
  `INSERT INTO calls (
    id, call_type, lead_id, matter_id, cm_user_id,
    client_name, client_phone,
    started_at, ended_at, duration_sec,
    audio_file_ref, status
  ) VALUES (
    $1, 'cm_call', $2, NULL, '005Pp000002WJxdIAG',
    'Maria Santos', '8622535625',
    now() - interval '15 minutes',
    now() - interval '11 minutes',
    231,
    '/demo/audio/maria_cm_call.mp3',
    'scored'
  )`,
  [CM_CALL_ID, LEAD_ID]
)

// --- Injuries (per body region) ---
await client.query(
  `INSERT INTO injuries (id, lead_id, body_region, severity, er_admitted, er_facility, current_phase, next_action)
   VALUES
    ($1, $4, 'cervical', 'severe', true, 'Robert Wood Johnson', 'conservative', 'Confirm PT appointment'),
    ($2, $4, 'lumbar',   'severe', true, 'Robert Wood Johnson', 'imaging',     'Confirm MRI order — radicular pain suggests L4-L5'),
    ($3, $4, 'shoulder_r','moderate', true,'Robert Wood Johnson', 'conservative', 'Evaluate at next PT visit')`,
  [INJ_CERVICAL, INJ_LUMBAR, INJ_SHOULDER, LEAD_ID]
)

// --- Treatment events ---
// Cervical: ER completed, PT recommended (auto-extracted), MRI scheduled
// Lumbar: ER completed, PT recommended (auto), MRI scheduled (auto, urgent)
// Shoulder: ER completed only
await client.query(
  `INSERT INTO treatment_events (
    id, injury_id, modality, status,
    provider_name, scheduled_date, completed_date,
    outcome, findings, auto_extracted_from_call_id, auto_extracted_confidence
  ) VALUES
    ('evt-cervical-er',    $1, 'er', 'completed', 'Robert Wood Johnson ED', NULL, $4, 'no_change', $5::jsonb, NULL, NULL),
    ('evt-cervical-pt',    $1, 'pt', 'recommended', NULL, NULL, NULL, NULL, NULL, $7, 'high'),
    ('evt-cervical-mri',   $1, 'mri', 'scheduled', 'Open MRI Hollywood', $6, NULL, 'pending_read', NULL, $7, 'high'),
    ('evt-lumbar-er',      $2, 'er', 'completed', 'Robert Wood Johnson ED', NULL, $4, 'no_change', $5::jsonb, NULL, NULL),
    ('evt-lumbar-pt',      $2, 'pt', 'recommended', NULL, NULL, NULL, NULL, NULL, $7, 'high'),
    ('evt-lumbar-mri',     $2, 'mri', 'scheduled', 'Open MRI Hollywood', $6, NULL, 'pending_read', $8::jsonb, $7, 'high'),
    ('evt-shoulder-er',    $3, 'er', 'completed', 'Robert Wood Johnson ED', NULL, $4, 'no_change', NULL, NULL, NULL)
  `,
  [
    INJ_CERVICAL, INJ_LUMBAR, INJ_SHOULDER,
    '2026-04-15',
    JSON.stringify({ imaging: 'x-rays + CT', results: 'no acute fracture' }),
    '2026-04-30', CM_CALL_ID,
    JSON.stringify({ urgency: 'radicular pain — suspect L4-L5 herniation' }),
  ]
)

console.log('Seeded Maria lead + calls + injuries + treatment events + appointment + agreement.')
await client.end()
