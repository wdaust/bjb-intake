/**
 * Tests for the CM call scorer that powers the CallScoreCard on the
 * Post-Call Summary. Confirms the four dimensions move in the directions
 * we've promised the demo will show.
 */

import { describe, expect, it } from 'vitest'

import { scoreCmCall } from './cmCallScoring'
import type { CapturedCallData } from '@/types'

function captured(overrides: Partial<CapturedCallData> = {}): CapturedCallData {
  return { ...overrides }
}

describe('scoreCmCall — information_capture', () => {
  it('empty call → 0', () => {
    const s = scoreCmCall(captured())
    expect(s.information_capture.score).toBe(0)
    expect(s.information_capture.missed_items?.length).toBeGreaterThan(0)
  })

  it('all five required fields → 100', () => {
    const s = scoreCmCall(
      captured({
        treatmentStatus: 'actively_treating',
        lastAppointmentDate: '2026-04-22',
        nextAppointmentStatus: 'scheduled',
        symptomDirection: 'better',
        progressionQuality: 'helping_a_lot',
      }),
    )
    expect(s.information_capture.score).toBe(100)
    expect(s.information_capture.missed_items).toBeUndefined()
  })

  it('partial capture surfaces missed items', () => {
    const s = scoreCmCall(
      captured({
        treatmentStatus: 'actively_treating',
        nextAppointmentStatus: 'scheduled',
      }),
    )
    expect(s.information_capture.score).toBeGreaterThan(0)
    expect(s.information_capture.score).toBeLessThan(100)
    expect(s.information_capture.missed_items).toContain('Last appointment')
  })
})

describe('scoreCmCall — compliance', () => {
  it('all required disclosures present → 100', () => {
    const s = scoreCmCall(
      captured({
        treatmentStatus: 'actively_treating',
        notes: 'caller confirmed PT scheduled',
      }),
    )
    expect(s.compliance.score).toBe(100)
    expect(s.compliance.issues).toBeUndefined()
  })

  it('missing treatment status drops score', () => {
    const s = scoreCmCall(captured({ notes: 'note' }))
    expect(s.compliance.score).toBeLessThanOrEqual(80)
    expect(s.compliance.issues).toContain('Treatment status not confirmed')
  })

  it('barrier flagged without details is an issue', () => {
    const s = scoreCmCall(
      captured({
        treatmentStatus: 'inconsistent',
        notes: 'x',
        barrierType: 'cost_concern',
      }),
    )
    expect(s.compliance.issues).toContain('Barrier flagged without detail')
  })
})

describe('scoreCmCall — empathy', () => {
  it('disengaged penalty', () => {
    const s = scoreCmCall(captured({ engagementLevel: 'disengaged' }))
    expect(s.empathy.score).toBeLessThan(75)
  })

  it('emotional state recognition + barrier ID raises score', () => {
    const baseline = scoreCmCall(captured()).empathy.score
    const enhanced = scoreCmCall(
      captured({
        clientEmotionalState: 'fearful',
        barrierType: 'nervous_anxious',
      }),
    ).empathy.score
    expect(enhanced).toBeGreaterThan(baseline)
  })

  it('clamps to [40, 100]', () => {
    const low = scoreCmCall(captured({ engagementLevel: 'disengaged' }))
    const high = scoreCmCall(
      captured({
        engagementLevel: 'engaged',
        clientEmotionalState: 'fearful',
        barrierType: 'nervous_anxious',
      }),
    )
    expect(low.empathy.score).toBeGreaterThanOrEqual(40)
    expect(high.empathy.score).toBeLessThanOrEqual(100)
  })
})

describe('scoreCmCall — call_progression', () => {
  it('scheduled next appointment → high', () => {
    const s = scoreCmCall(
      captured({
        nextAppointmentStatus: 'scheduled',
        symptomDirection: 'better',
        progressionQuality: 'helping_a_lot',
      }),
    )
    expect(s.call_progression.score).toBeGreaterThanOrEqual(85)
  })

  it('not_scheduled penalizes vs scheduled', () => {
    const scheduled = scoreCmCall(
      captured({ nextAppointmentStatus: 'scheduled' }),
    ).call_progression.score
    const notScheduled = scoreCmCall(
      captured({ nextAppointmentStatus: 'not_scheduled' }),
    ).call_progression.score
    expect(scheduled).toBeGreaterThan(notScheduled)
  })

  it('missing next-step status surfaces in missed_items', () => {
    const s = scoreCmCall(captured({ symptomDirection: 'same' }))
    expect(s.call_progression.missed_items).toContain('Next-step status')
  })
})

describe('scoreCmCall — overall shape', () => {
  it('returns all four dimensions', () => {
    const s = scoreCmCall(captured())
    expect(s).toHaveProperty('information_capture')
    expect(s).toHaveProperty('compliance')
    expect(s).toHaveProperty('empathy')
    expect(s).toHaveProperty('call_progression')
  })

  it('every score is 0..100 inclusive', () => {
    const inputs: CapturedCallData[] = [
      {},
      { engagementLevel: 'disengaged' },
      {
        treatmentStatus: 'actively_treating',
        notes: 'n',
        nextAppointmentStatus: 'scheduled',
        symptomDirection: 'better',
        progressionQuality: 'helping_a_lot',
        engagementLevel: 'engaged',
      },
    ]
    for (const input of inputs) {
      const s = scoreCmCall(input)
      for (const dim of [s.information_capture, s.compliance, s.empathy, s.call_progression]) {
        expect(dim.score).toBeGreaterThanOrEqual(0)
        expect(dim.score).toBeLessThanOrEqual(100)
      }
    }
  })
})
