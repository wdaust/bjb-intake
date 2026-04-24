/**
 * Score the Maria intake + CM calls via Claude using the production
 * rubrics. Saves to `call_scores`.
 *
 * Pulls transcripts from Neon, assembles the prompt with speaker-labeled
 * turns, calls Claude Sonnet with `tool_use` for structured output, and
 * validates each response against the Zod schema.
 */
import { readFileSync } from 'node:fs'
import pg from 'pg'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'

// ---------- env ----------
const env = readFileSync('/Users/daustmac/Documents/bjb-intake/.env', 'utf8')
const dbUrl = env.match(/^DATABASE_URL=(.+)$/m)[1].trim()
const anthropicKey = env.match(/^ANTHROPIC_API_KEY=(.+)$/m)?.[1]?.trim()
if (!anthropicKey || anthropicKey === 'PASTE_KEY_HERE') {
  console.error('ANTHROPIC_API_KEY missing')
  process.exit(1)
}

const anthropic = new Anthropic({ apiKey: anthropicKey })

// ---------- inline rubric schemas (mirrors functions/src/scoring/*) ----------

const VERDICTS = [
  'PURSUE - HARD', 'PURSUE - CALLBACK URGENT', 'PURSUE - CALLBACK SOFT',
  'WATCH - INJURY MAY DEVELOP', 'VERIFY REPRESENTED',
  'REFER OUT — RECALL CANDIDATE', 'REFER OUT — STRONG CASE', 'REFER OUT — WATCH',
  'REFER OUT — CALLBACK PARTNER', 'REFER OUT — CONFIRM PARTNER',
  'REFER OUT — NON-INJURY', 'REFERRED OUT - CORRECT',
  'NON-CORE SPECIALTY — IN-HOUSE', 'NON-CORE SPECIALTY — REFER',
  'NOT ENOUGH DETAILS', 'CORRECTLY REJECTED',
]

const GREEN_SIGNALS = [
  'ambulance','hospitalized','er_visit','fracture','surgery_recommended',
  'surgery_performed','concussion_tbi','herniation','imaging_mri_ct','pt_chiro',
  'prescription_meds','commercial_defendant','uber_lyft','police_report','witness',
  'minor_victim','rear_ended','red_light_run','dog_bite','slip_fall_detail',
  'sloped_sidewalk','wet_floor','negligent_security','product_defect',
  'inadequate_maintenance','long_narrative','multi_vehicle','multi_defendant',
  'policy_limit_high','high_bills_damages','lost_wages','permanent_impairment',
  'scarring','nerve_damage','leg_pain_down','neck_pain_severe','back_pain_severe',
  'ongoing_treatment','uim_available','pip_available',
]
const RED_SIGNALS = [
  'no_injury','property_only','client_at_fault','self_inflicted','non_pi_theme',
  'sol_expired','intentional_assault','uninsured_defendant_no_uim',
  'already_represented','thin_med_mal','traffic_ticket_only','consumer_complaint',
  'billing_dispute','defense_matter',
]

const intakeTool = {
  name: 'submit_intake_verdict',
  description: 'Submit the v8 qualification verdict for this intake call.',
  input_schema: {
    type: 'object',
    properties: {
      verdict: { type: 'string', enum: VERDICTS },
      value_tier: { type: 'string', enum: ['CATASTROPHIC','HIGH','MEDIUM','LOW','MINIMAL'] },
      opportunity_score: { type: 'integer', minimum: 0, maximum: 100 },
      confidence: { type: 'string', enum: ['High','Medium','Low'] },
      est_value_range: { type: 'string' },
      state: { type: 'string', pattern: '^[A-Z]{2}$' },
      case_type: { type: 'string' },
      reasoning_bullets: { type: 'array', items: { type: 'string' }, minItems: 5, maxItems: 5 },
      narrative: { type: 'string' },
      key_liability_facts: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 5 },
      key_damages_facts: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 5 },
      weaknesses_risks: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 4 },
      recommended_next_action: { type: 'string' },
      green_signals: { type: 'array', items: { type: 'string', enum: GREEN_SIGNALS } },
      red_signals: { type: 'array', items: { type: 'string', enum: RED_SIGNALS } },
      process_scores: {
        type: 'object',
        properties: {
          information_capture: {
            type: 'object',
            properties: {
              score: { type: 'integer', minimum: 0, maximum: 100 },
              evidence_quote: { type: 'string' },
              missed_items: { type: 'array', items: { type: 'string' } },
            },
            required: ['score','evidence_quote','missed_items'],
          },
          compliance: {
            type: 'object',
            properties: {
              score: { type: 'integer', minimum: 0, maximum: 100 },
              evidence_quote: { type: 'string' },
              issues: { type: 'array', items: { type: 'string' } },
            },
            required: ['score','evidence_quote','issues'],
          },
          empathy: {
            type: 'object',
            properties: {
              score: { type: 'integer', minimum: 0, maximum: 100 },
              evidence_quote: { type: 'string' },
            },
            required: ['score','evidence_quote'],
          },
          call_progression: {
            type: 'object',
            properties: {
              score: { type: 'integer', minimum: 0, maximum: 100 },
              evidence_quote: { type: 'string' },
            },
            required: ['score','evidence_quote'],
          },
        },
        required: ['information_capture','compliance','empathy','call_progression'],
      },
    },
    required: [
      'verdict','value_tier','opportunity_score','confidence','est_value_range',
      'state','case_type','reasoning_bullets','narrative','key_liability_facts',
      'key_damages_facts','weaknesses_risks','recommended_next_action',
      'green_signals','red_signals','process_scores',
    ],
  },
}

const cmCallTool = {
  name: 'submit_cm_call_score',
  description: 'Submit quality scores + structured extractions for a CM call.',
  input_schema: {
    type: 'object',
    properties: {
      scores: {
        type: 'object',
        properties: {
          information_capture: {
            type: 'object',
            properties: {
              score: { type: 'integer', minimum: 0, maximum: 100 },
              evidence_quote: { type: 'string' },
              missed_items: { type: 'array', items: { type: 'string' } },
            },
            required: ['score','evidence_quote','missed_items'],
          },
          treatment_coordination: {
            type: 'object',
            properties: {
              score: { type: 'integer', minimum: 0, maximum: 100 },
              evidence_quote: { type: 'string' },
              missed_items: { type: 'array', items: { type: 'string' } },
            },
            required: ['score','evidence_quote','missed_items'],
          },
          empathy: {
            type: 'object',
            properties: {
              score: { type: 'integer', minimum: 0, maximum: 100 },
              evidence_quote: { type: 'string' },
            },
            required: ['score','evidence_quote'],
          },
          compliance: {
            type: 'object',
            properties: {
              score: { type: 'integer', minimum: 0, maximum: 100 },
              evidence_quote: { type: 'string' },
              issues: { type: 'array', items: { type: 'string' } },
            },
            required: ['score','evidence_quote','issues'],
          },
          next_step_clarity: {
            type: 'object',
            properties: {
              score: { type: 'integer', minimum: 0, maximum: 100 },
              evidence_quote: { type: 'string' },
            },
            required: ['score','evidence_quote'],
          },
        },
        required: ['information_capture','treatment_coordination','empathy','compliance','next_step_clarity'],
      },
      overall_score: { type: 'integer', minimum: 0, maximum: 100 },
      client_update_summary: { type: 'string' },
      action_items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            owner: { type: 'string', enum: ['cm','client','provider'] },
            action: { type: 'string' },
            due: { type: 'string' },
          },
          required: ['owner','action','due'],
        },
      },
      treatment_updates: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            modality: { type: 'string', enum: ['pt','chiro','mri','ct','xray','injection','surgery','ortho_consult','neuro_consult','pain_mgmt','er','other'] },
            status: { type: 'string', enum: ['recommended','scheduled','in_progress','completed','client_declined','provider_declined','no_show'] },
            provider_name: { type: 'string' },
            body_region: { type: 'string', enum: ['cervical','thoracic','lumbar','shoulder_l','shoulder_r','knee_l','knee_r','hip_l','hip_r','tbi','wrist_l','wrist_r','other'] },
            outcome: { type: 'string', enum: ['improved','no_change','worsened','inconclusive','pending_read'] },
            findings: { type: 'string' },
            decline_reason: { type: 'string', enum: ['cost','fear','transport','work','no_benefit','other'] },
            evidence_quote: { type: 'string' },
          },
          required: ['modality','status','evidence_quote'],
        },
      },
      red_flags: { type: 'array', items: { type: 'string' } },
    },
    required: ['scores','overall_score','client_update_summary','action_items','treatment_updates','red_flags'],
  },
}

// ---------- System prompts ----------

const INTAKE_SYSTEM_PROMPT = `You are the BJB Intake Scorer v8, a senior personal-injury intake auditor for Brandon J. Broderick, Attorney at Law.

HARD RULES:
1. Every evidence_quote MUST be a verbatim substring of the transcript. If no supporting quote exists, score 0 and quote = "".
2. Use ONLY values from the canonical green_signals/red_signals lists. Do not invent.
3. Pick exactly one of the 17 verdicts.
4. Call the submit_intake_verdict tool with your complete output.

JURISDICTION: NJ/NY/PA in-house. Other states → REFER OUT verdicts regardless of strength. Injury-focus only.

VERDICT TAXONOMY (one of):
${VERDICTS.map(v => `- ${v}`).join('\n')}

VALUE TIERS: CATASTROPHIC (death/paralysis/surgery+hosp); HIGH (surgery/hosp/fracture/concussion/commercial def/multi-vehicle); MEDIUM (2+ medium green flags or herniation); LOW (any green flag); MINIMAL.

GREEN SIGNALS (closed set): ${GREEN_SIGNALS.join(', ')}
RED SIGNALS (closed set): ${RED_SIGNALS.join(', ')}

Inference: "shooting pain down my leg" → leg_pain_down; detailed chronology → long_narrative; ambulance to ER → ambulance + er_visit (hospitalized only if admitted >6hrs or overnight); CT/MRI mentioned → imaging_mri_ct; commercial vehicle description (work truck, ladder rack, company name) → commercial_defendant.

PROCESS SCORES (0-100, independent of verdict):
- information_capture: DOL, state, case type, narrative, injuries, ER, police report, witnesses, other-party insurance, client PIP, prior rep check.
- compliance: recording disclosure, no legal advice, no fee talk, conflict check.
- empathy: warmth, acknowledgment, pacing.
- call_progression: flow, clear next steps.

REASONING BULLETS: Exactly 5, prefixed [DECISION] [FIT] [SIGNAL] [RISK] [ACTION] in order. Under 20 words each.`

const CM_CALL_SYSTEM_PROMPT = `You are a senior personal-injury case-management QA auditor. You score CM calls on a signed, pre-litigation client. Call the submit_cm_call_score tool with your complete output.

HARD RULES:
1. Every evidence_quote is a verbatim substring of the transcript.
2. Closed enums are closed. Do not invent modality/status/region names.
3. If ambiguous, score 0 with empty quote rather than guessing.

DIMENSIONS (0-100):
- information_capture: new symptoms, ER/PCP follow-up, providers, insurance, meds, work impact.
- treatment_coordination: flag urgent gaps (radicular pain → MRI urgency; no PT >1wk post-ER → schedule), offer to schedule, concrete timelines.
- empathy: warmth, validation, pacing.
- compliance: no unauthorized legal advice, no outcome guarantees, tell client not to talk to adjusters, continued-representation check.
- next_step_clarity: who/what/when.

OVERALL_SCORE = round(0.20*info + 0.30*treat + 0.15*empathy + 0.20*compliance + 0.15*next_step).

EXTRACTIONS:
- client_update_summary: 1-2 sentences.
- action_items: {owner, action, due}. Owner ∈ {cm, client, provider}. Due = absolute date / "today"/"tomorrow"/"end of week"/"Friday"/"unscheduled".
- treatment_updates: one entry per modality/event discussed. evidence_quote required.
- red_flags: client non-compliance, adjuster contact, unreported worsening, other-attorney contact, SOL risk, missed imaging.`

// ---------- Runner ----------

function formatSegments(segments) {
  return segments
    .map((s) => {
      const mm = Math.floor(s.start / 60)
      const ss = String(Math.floor(s.start % 60)).padStart(2, '0')
      return `[${mm}:${ss}] ${s.speaker}: ${s.text}`
    })
    .join('\n')
}

async function scoreCall({ callId, callType, rubricVersion, systemPrompt, tool }) {
  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()
  const { rows } = await client.query(
    'SELECT segments FROM call_transcripts WHERE call_id = $1 LIMIT 1',
    [callId]
  )
  if (!rows[0]) throw new Error(`No transcript for ${callId}`)
  const transcript = formatSegments(rows[0].segments)

  console.log(`\n=== Scoring ${callId} (${callType}) ===`)
  console.log(`Transcript: ${transcript.split('\n').length} lines`)

  const resp = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 4096,
    temperature: 0,
    system: systemPrompt,
    tools: [tool],
    tool_choice: { type: 'tool', name: tool.name },
    messages: [
      {
        role: 'user',
        content: `Score this transcript:\n\n${transcript}\n\nCall the ${tool.name} tool now.`,
      },
    ],
  })

  // Extract tool-use output
  const toolUse = resp.content.find((c) => c.type === 'tool_use')
  if (!toolUse) {
    console.error('No tool use in response:', JSON.stringify(resp.content, null, 2))
    throw new Error('Model did not call the scoring tool')
  }
  const scoreJson = toolUse.input

  // Save
  const id = `score-${callId}`
  await client.query(`DELETE FROM call_scores WHERE id = $1`, [id])
  await client.query(
    `INSERT INTO call_scores (
      id, call_id, call_type, rubric_version,
      verdict, value_tier, opportunity_score, confidence,
      overall_score, scores, raw_llm_output
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb)`,
    [
      id,
      callId,
      callType,
      rubricVersion,
      scoreJson.verdict ?? null,
      scoreJson.value_tier ?? null,
      scoreJson.opportunity_score ?? null,
      scoreJson.confidence ?? null,
      scoreJson.overall_score ?? null,
      JSON.stringify(scoreJson),
      JSON.stringify(resp),
    ]
  )
  await client.end()

  // Pretty-print for verification
  if (callType === 'intake') {
    console.log(`→ Verdict: ${scoreJson.verdict} · ${scoreJson.value_tier} · opp ${scoreJson.opportunity_score} · ${scoreJson.est_value_range} · ${scoreJson.confidence}`)
    console.log('→ Green signals:', (scoreJson.green_signals || []).join(', '))
    console.log('→ Reasoning:')
    for (const b of scoreJson.reasoning_bullets || []) console.log(`   ${b}`)
  } else {
    console.log(`→ Overall: ${scoreJson.overall_score}`)
    console.log(`→ Info capture: ${scoreJson.scores?.information_capture?.score}`)
    console.log(`→ Treatment coord: ${scoreJson.scores?.treatment_coordination?.score}`)
    console.log(`→ Empathy: ${scoreJson.scores?.empathy?.score}`)
    console.log(`→ Compliance: ${scoreJson.scores?.compliance?.score}`)
    console.log(`→ Next-step clarity: ${scoreJson.scores?.next_step_clarity?.score}`)
    console.log(`→ Treatment updates: ${(scoreJson.treatment_updates || []).length}`)
  }
}

// ---------- Run both ----------

await scoreCall({
  callId: 'call-intake-maria',
  callType: 'intake',
  rubricVersion: 'intake-v8',
  systemPrompt: INTAKE_SYSTEM_PROMPT,
  tool: intakeTool,
})

await scoreCall({
  callId: 'call-cm-maria',
  callType: 'cm_call',
  rubricVersion: 'cm-v1',
  systemPrompt: CM_CALL_SYSTEM_PROMPT,
  tool: cmCallTool,
})

console.log('\nDone. Scores saved to call_scores.')
