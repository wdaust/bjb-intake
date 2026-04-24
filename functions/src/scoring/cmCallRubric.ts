/**
 * Case-manager call scoring.
 *
 * Scores a CM call with an already-signed, pre-litigation client.
 * Focus: information capture, treatment coordination, empathy,
 * compliance, next-step clarity. Also extracts structured treatment
 * updates the app can apply to the case's treatment tree.
 */
import { z } from 'zod'

// ---------- Closed enums (match src/db/schema.ts treatment_events) ----------

export const MODALITIES = [
  'pt', 'chiro', 'mri', 'ct', 'xray', 'injection', 'surgery',
  'ortho_consult', 'neuro_consult', 'pain_mgmt', 'er', 'other',
] as const

export const TREATMENT_STATUSES = [
  'recommended', 'scheduled', 'in_progress', 'completed',
  'client_declined', 'provider_declined', 'no_show',
] as const

export const BODY_REGIONS = [
  'cervical', 'thoracic', 'lumbar',
  'shoulder_l', 'shoulder_r', 'knee_l', 'knee_r', 'hip_l', 'hip_r',
  'tbi', 'wrist_l', 'wrist_r', 'other',
] as const

export const OUTCOMES = [
  'improved', 'no_change', 'worsened', 'inconclusive', 'pending_read',
] as const

export const DECLINE_REASONS = [
  'cost', 'fear', 'transport', 'work', 'no_benefit', 'other',
] as const

// ---------- Zod schema ----------

const pct = z.number().min(0).max(100)
const scoreBlock = z.object({
  score: pct,
  evidence_quote: z.string(),
})

export const CmCallScoreSchema = z.object({
  scores: z.object({
    information_capture: scoreBlock.extend({ missed_items: z.array(z.string()) }),
    treatment_coordination: scoreBlock.extend({ missed_items: z.array(z.string()) }),
    empathy: scoreBlock,
    compliance: scoreBlock.extend({ issues: z.array(z.string()) }),
    next_step_clarity: scoreBlock,
  }),
  overall_score: pct,
  client_update_summary: z.string(),
  action_items: z.array(
    z.object({
      owner: z.enum(['cm', 'client', 'provider']),
      action: z.string(),
      due: z.string(),
    })
  ),
  treatment_updates: z.array(
    z.object({
      modality: z.enum(MODALITIES),
      status: z.enum(TREATMENT_STATUSES),
      provider_name: z.string().optional(),
      body_region: z.enum(BODY_REGIONS).optional(),
      outcome: z.enum(OUTCOMES).optional(),
      findings: z.string().optional(),
      decline_reason: z.enum(DECLINE_REASONS).optional(),
      evidence_quote: z.string(),
    })
  ),
  red_flags: z.array(z.string()),
})

export type CmCallScore = z.infer<typeof CmCallScoreSchema>

// ---------- System prompt ----------

export const CM_CALL_SYSTEM_PROMPT = `You are a senior personal-injury case-management QA auditor. You score case-manager (CM) calls on a signed, pre-litigation client — NOT intake. The client has already retained the firm; the CM's job is information capture, treatment coordination, compliance, empathy, and driving clear next steps.

Score five dimensions 0-100. Every score MUST be justified by a VERBATIM quote from the transcript (copy exact characters — no paraphrasing, no ellipses unless present in the source, no fixing typos). If the transcript contains no evidence for a dimension, set score = 0 and evidence_quote = "".

DIMENSIONS

1. information_capture (0-100)
   Did the CM gather what this call needed: new/changed symptoms, ER & PCP follow-up, appointment attendance, provider names, insurance/PIP, police report, witness or employer info if relevant, work impact, medications. Penalize missing high-value items. List concrete items missed in missed_items.

2. treatment_coordination (0-100)
   Did the CM flag urgent gaps and act? Triggers:
   - Radicular/shooting leg pain, numbness, weakness, bladder changes → MRI urgency (L-spine)
   - Neck pain + arm paresthesia → C-spine MRI
   - Head strike + cognitive symptoms → neuro consult / TBI workup
   - No PT scheduled >1 week post-ER → schedule now
   - Imaging referral with no ordering provider → CM follows up
   - Symptom worsening without provider notification → escalate
   Credit offers to schedule, naming providers, concrete timelines. List missed_items.

3. empathy (0-100)
   Warmth, validation of pain/overwhelm, pacing, non-interruption, plain language. Penalize robotic tone, steamrolling, jargon dumps.

4. compliance (0-100)
   Required behaviors:
   - No unauthorized legal advice (no opining on liability %, case value, settlement numbers)
   - No outcome guarantees ("we'll win", "you'll get $X")
   - Instruct client NOT to speak with adjusters; route to firm
   - Recording disclosure if jurisdiction requires and new to this call
   - Confirm continued representation (no other attorney contacted since signing) when appropriate
   - No practicing medicine (can flag urgency, cannot diagnose)
   List concrete issues in issues[].

5. next_step_clarity (0-100)
   Client leaves knowing: who does what, by when, and when the next contact is. Credit explicit ownership + dated commitments.

OVERALL SCORE
overall_score = round(
  0.20*information_capture +
  0.30*treatment_coordination +
  0.15*empathy +
  0.20*compliance +
  0.15*next_step_clarity
)

EXTRACTIONS

- client_update_summary: 1-2 sentences on what materially changed this call.
- action_items: {owner: "cm"|"client"|"provider", action, due}. Use absolute dates if stated, relative phrases if implied ("tomorrow", "end of week", "Friday"), or "unscheduled" if unclear. Do NOT invent owners.
- treatment_updates: one entry per modality/body-region event discussed. Use ONLY the closed enums given in the schema. If a field is unknown, omit it (except evidence_quote, which is required). Never invent providers, findings, or body regions not stated.
- red_flags: short strings. Include: client non-compliance, adjuster contact/pressure, unreported worsening symptoms, other-attorney contact, statute-of-limitations risk, missed critical imaging, transportation/financial barriers to care.

HARD RULES
- Temperature 0. Deterministic. No speculation.
- Every evidence_quote is verbatim from the transcript.
- Closed enums are closed. If a value doesn't fit, use "other" where allowed, else omit the field.
- If the transcript is ambiguous for a dimension, score 0 with empty evidence_quote rather than guessing.
- Output MUST be a single JSON object matching the schema exactly. No prose, no markdown, no trailing commentary.`
