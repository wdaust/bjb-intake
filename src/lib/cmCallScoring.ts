/**
 * Deterministic 4-dim score generator for case-manager Guided Calls.
 *
 * The intake flow already has a Claude-scored CallScoreCard wired to
 * `CallScores` (information_capture / compliance / empathy / call_progression).
 * Once the production pipeline is in place we'll feed real diarized
 * transcripts to Claude and persist `call_scores` rows. Until then this maps
 * captured CM-call signals to the same shape so the rest of the UI works
 * end-to-end.
 *
 * The scoring is intentionally simple and explainable:
 *   - information_capture rises with the number of captured fields
 *   - compliance flags missing required disclosures (notes, treatment status)
 *   - empathy infers from emotional state + barrier handling
 *   - call_progression infers from whether next steps were captured
 */

import type { CapturedCallData } from '@/types'
import type { CallScores } from '@/components/intake/CallScoreCard'

export function scoreCmCall(data: CapturedCallData): CallScores {
  return {
    information_capture: scoreInfoCapture(data),
    compliance: scoreCompliance(data),
    empathy: scoreEmpathy(data),
    call_progression: scoreProgression(data),
  }
}

function scoreInfoCapture(d: CapturedCallData): CallScores['information_capture'] {
  const required: Array<keyof CapturedCallData> = [
    'treatmentStatus',
    'lastAppointmentDate',
    'nextAppointmentStatus',
    'symptomDirection',
    'progressionQuality',
  ]
  const captured = required.filter((k) => Boolean(d[k]))
  const score = Math.round((captured.length / required.length) * 100)
  const missed = required
    .filter((k) => !d[k])
    .map((k) => fieldLabel(k))

  const evidence =
    captured.length === required.length
      ? 'Captured every required field for this call type.'
      : captured.length === 0
      ? 'No structured data captured during this call.'
      : `Captured ${captured.length}/${required.length} required fields including ${captured.map(fieldLabel).slice(0, 2).join(' + ')}.`

  return {
    score,
    evidence_quote: evidence,
    missed_items: missed.length > 0 ? missed : undefined,
  }
}

function scoreCompliance(d: CapturedCallData): CallScores['compliance'] {
  const issues: string[] = []
  let score = 100

  if (!d.treatmentStatus) {
    issues.push('Treatment status not confirmed')
    score -= 20
  }
  if (!d.notes) {
    issues.push('No call notes recorded')
    score -= 10
  }
  if (d.barrierType && !d.barrierDetails) {
    issues.push('Barrier flagged without detail')
    score -= 15
  }

  return {
    score: Math.max(0, score),
    evidence_quote:
      score >= 90
        ? 'All required disclosures and confirmations completed.'
        : 'Some required confirmations were skipped or incomplete.',
    issues: issues.length > 0 ? issues : undefined,
  }
}

function scoreEmpathy(d: CapturedCallData): CallScores['empathy'] {
  let score = 75

  if (d.clientEmotionalState) {
    score += 8 // recognized emotional state
  }
  if (d.barrierType) {
    // Identifying a barrier shows engagement
    score += 8
  }
  if (d.engagementLevel === 'engaged') score += 7
  if (d.engagementLevel === 'disengaged') score -= 10

  return {
    score: Math.max(40, Math.min(100, score)),
    evidence_quote:
      d.clientEmotionalState
        ? `Acknowledged client emotional state: ${d.clientEmotionalState}.`
        : 'Tone was professional but emotional acknowledgement was light.',
  }
}

function scoreProgression(d: CapturedCallData): CallScores['call_progression'] {
  let score = 60

  if (d.nextAppointmentStatus === 'scheduled') score += 25
  else if (d.nextAppointmentStatus === 'waiting_callback') score += 10
  else if (d.nextAppointmentStatus === 'not_scheduled') score -= 5
  if (d.symptomDirection) score += 5
  if (d.progressionQuality) score += 10

  const missed: string[] = []
  if (!d.nextAppointmentStatus) missed.push('Next-step status')
  if (!d.symptomDirection) missed.push('Symptom direction')

  return {
    score: Math.max(35, Math.min(100, score)),
    evidence_quote:
      d.nextAppointmentStatus === 'scheduled'
        ? 'Confirmed next appointment is scheduled — clear forward path.'
        : 'Next steps were partially defined; case advancement may stall.',
    missed_items: missed.length > 0 ? missed : undefined,
  }
}

function fieldLabel(k: keyof CapturedCallData): string {
  const map: Partial<Record<keyof CapturedCallData, string>> = {
    treatmentStatus: 'Treatment status',
    lastAppointmentDate: 'Last appointment',
    nextAppointmentStatus: 'Next-step status',
    nextAppointmentDate: 'Next appointment date',
    symptomDirection: 'Symptom direction',
    progressionQuality: 'Treatment progression',
    barrierType: 'Barrier type',
    barrierDetails: 'Barrier detail',
    notes: 'Call notes',
    engagementLevel: 'Engagement level',
    clientEmotionalState: 'Emotional state',
  }
  return map[k] ?? String(k)
}
