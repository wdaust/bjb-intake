/**
 * Tests for case-track derivation. The chip on every queue/caseload row
 * answers "where is this case heading?", so this logic is demo-critical
 * and easy to break by tweaking the heuristics. Each branch is locked in
 * here.
 */

import { describe, expect, it, beforeEach } from 'vitest'

import {
  deriveCaseTrack,
  resolveCaseTrack,
  deriveTrackFromCaseView,
  resolveTrackForCaseView,
  writeTrackOverride,
  readTrackOverrides,
  clearTrackOverride,
  TRACK_REASONS,
  type CaseTrack,
} from './caseTrack'
import type { CaseForRanking } from './callQueueRanker'
import type { FullCaseView } from '@/types'

// --- localStorage shim for node test env ----------------------------------

class MemoryStorage {
  private store = new Map<string, string>()
  getItem(k: string) { return this.store.get(k) ?? null }
  setItem(k: string, v: string) { this.store.set(k, v) }
  removeItem(k: string) { this.store.delete(k) }
  clear() { this.store.clear() }
  get length() { return this.store.size }
  key(i: number) { return Array.from(this.store.keys())[i] ?? null }
}

beforeEach(() => {
  const storage = new MemoryStorage()
  // jsdom is heavy; we just need window.localStorage + dispatchEvent.
  class TestCustomEvent {
    type: string
    init: unknown
    constructor(type: string, init?: unknown) {
      this.type = type
      this.init = init
    }
  }
  ;(globalThis as unknown as { window: unknown }).window = {
    localStorage: storage,
    dispatchEvent: () => true,
    CustomEvent: TestCustomEvent,
  }
})

// --- Fixtures -------------------------------------------------------------

function baseCase(overrides: Partial<CaseForRanking> = {}): CaseForRanking {
  return {
    id: 'CASE-1',
    clientName: 'Test Client',
    caseType: 'MVA',
    estValue: 50_000,
    slaDeadline: null,
    lastContactAt: null,
    lastTreatmentEventAt: null,
    redSignals: [],
    openAction: null,
    verdict: null,
    ...overrides,
  }
}

function baseCaseView(overrides: Partial<FullCaseView> = {}): FullCaseView {
  return {
    client: { fullName: 'A', state: 'NJ' } as any,
    caseData: {
      id: 'cv-1',
      currentStage: 'active_treatment',
    } as any,
    treatment: {} as any,
    providers: [],
    referrals: [],
    operational: {
      caseId: 'cv-1',
      noContactDays: 0,
      treatmentGapDays: 0,
      unresolvedReferralDays: 0,
      currentRiskFlags: [],
      priorEscalations: [],
      outstandingTasks: 0,
      staleTasks: 0,
    } as any,
    scores: {} as any,
    ...overrides,
  }
}

// --- deriveCaseTrack ------------------------------------------------------

describe('deriveCaseTrack', () => {
  it('returns Cut when verdict mentions CUT', () => {
    const info = deriveCaseTrack(baseCase({ verdict: 'CUT-OUT' }))
    expect(info.track).toBe('cut')
    expect(info.progress).toBe(0)
    expect(info.reason).toMatch(/Cut/i)
  })

  it('returns Transfer when verdict mentions REFER', () => {
    const info = deriveCaseTrack(baseCase({ verdict: 'REFER-OUT' }))
    expect(info.track).toBe('transfer')
    expect(info.progress).toBe(0)
  })

  it('returns Litigation when redSignals match policy/multi-defendant/severe', () => {
    const cases = [
      baseCase({ redSignals: ['Policy limits exceeded'] }),
      baseCase({ redSignals: ['Multi-defendant exposure suspected'] }),
      baseCase({ redSignals: ['Severe TBI confirmed'] }),
      baseCase({ redSignals: ['5 building owners stacked'] }),
    ]
    for (const c of cases) {
      expect(deriveCaseTrack(c).track).toBe('litigation')
    }
  })

  it('returns Litigation when value high AND verdict pursue-hard', () => {
    const info = deriveCaseTrack(
      baseCase({ estValue: 300_000, verdict: 'PURSUE-HARD' }),
    )
    expect(info.track).toBe('litigation')
  })

  it('returns RFD by default', () => {
    expect(deriveCaseTrack(baseCase()).track).toBe('rfd')
  })

  it('clamps progress between 5 and 95', () => {
    const c = baseCase({ estValue: 1_000_000, lastTreatmentEventAt: new Date().toISOString() })
    const info = deriveCaseTrack(c)
    expect(info.progress).toBeGreaterThanOrEqual(5)
    expect(info.progress).toBeLessThanOrEqual(95)
  })

  it('penalizes stale contact in progress', () => {
    const fresh = deriveCaseTrack(
      baseCase({ estValue: 100_000, lastContactAt: new Date().toISOString() }),
    )
    const stale = deriveCaseTrack(
      baseCase({
        estValue: 100_000,
        lastContactAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    )
    expect(stale.progress).toBeLessThan(fresh.progress)
  })

  it('case-insensitive verdict matching', () => {
    expect(deriveCaseTrack(baseCase({ verdict: 'cut' })).track).toBe('cut')
    expect(deriveCaseTrack(baseCase({ verdict: 'transfer' })).track).toBe('transfer')
  })

  it('Cut takes priority over litigation signals', () => {
    // If both apply, Cut wins (case is being killed regardless).
    const info = deriveCaseTrack(
      baseCase({
        verdict: 'CUT-OUT',
        redSignals: ['Policy limits exceeded'],
      }),
    )
    expect(info.track).toBe('cut')
  })
})

// --- override storage -----------------------------------------------------

describe('track overrides', () => {
  it('round-trips through localStorage', () => {
    writeTrackOverride('user-1', 'CASE-A', {
      track: 'litigation',
      reason: 'Multi-defendant exposure',
      setAt: '2026-04-24T00:00:00Z',
      setBy: 'user-1',
    })
    const all = readTrackOverrides('user-1')
    expect(all['CASE-A']?.track).toBe('litigation')
    expect(all['CASE-A']?.reason).toBe('Multi-defendant exposure')
  })

  it('separates overrides by user key', () => {
    writeTrackOverride('user-1', 'CASE-A', {
      track: 'cut', reason: 'x', setAt: '', setBy: 'user-1',
    })
    expect(readTrackOverrides('user-2')['CASE-A']).toBeUndefined()
    expect(readTrackOverrides('user-1')['CASE-A']?.track).toBe('cut')
  })

  it('clearTrackOverride removes the entry', () => {
    writeTrackOverride('user-1', 'CASE-A', {
      track: 'cut', reason: 'x', setAt: '', setBy: 'user-1',
    })
    clearTrackOverride('user-1', 'CASE-A')
    expect(readTrackOverrides('user-1')['CASE-A']).toBeUndefined()
  })

  it('returns empty object when storage is malformed', () => {
    ;(globalThis as any).window.localStorage.setItem('caos:cases:trackOverrides:u', 'not-json')
    expect(readTrackOverrides('u')).toEqual({})
  })
})

// --- resolveCaseTrack -----------------------------------------------------

describe('resolveCaseTrack', () => {
  it('falls back to derivation when no override exists', () => {
    const info = resolveCaseTrack(baseCase({ verdict: 'CUT' }), 'user-1')
    expect(info.track).toBe('cut')
    expect(info.isManualOverride).toBeFalsy()
  })

  it('manual override beats AI derivation', () => {
    writeTrackOverride('user-1', 'CASE-1', {
      track: 'litigation',
      reason: 'Policy limits exceeded',
      setAt: '',
      setBy: 'user-1',
    })
    // Even though no derivation signal points to litigation,
    // the override wins.
    const info = resolveCaseTrack(baseCase({ id: 'CASE-1' }), 'user-1')
    expect(info.track).toBe('litigation')
    expect(info.isManualOverride).toBe(true)
    expect(info.reason).toBe('Policy limits exceeded')
  })

  it('resolveCaseTrack without userKey does not consult overrides', () => {
    writeTrackOverride('user-1', 'CASE-1', {
      track: 'cut', reason: 'x', setAt: '', setBy: 'user-1',
    })
    const info = resolveCaseTrack(baseCase({ id: 'CASE-1' }))
    expect(info.track).toBe('rfd')
  })
})

// --- FullCaseView path ----------------------------------------------------

describe('deriveTrackFromCaseView', () => {
  it('cutReviewIndicator=yes wins', () => {
    const cv = baseCaseView({
      operational: { ...baseCaseView().operational, cutReviewIndicator: 'yes' } as any,
      caseData: { ...baseCaseView().caseData, cutRiskNote: 'Statute lapsed' } as any,
    })
    const info = deriveTrackFromCaseView(cv)
    expect(info.track).toBe('cut')
    expect(info.reason).toBe('Statute lapsed')
  })

  it('transferReviewIndicator=yes returns transfer', () => {
    const cv = baseCaseView({
      operational: { ...baseCaseView().operational, transferReviewIndicator: 'yes' } as any,
    })
    expect(deriveTrackFromCaseView(cv).track).toBe('transfer')
  })

  it('stage=litigation returns Litigation', () => {
    const cv = baseCaseView({
      caseData: { ...baseCaseView().caseData, currentStage: 'litigation' } as any,
    })
    expect(deriveTrackFromCaseView(cv).track).toBe('litigation')
  })

  it('demand_ready stage stays RFD', () => {
    const cv = baseCaseView({
      caseData: { ...baseCaseView().caseData, currentStage: 'demand_prep' } as any,
    })
    const info = deriveTrackFromCaseView(cv)
    expect(info.track).toBe('rfd')
    expect(info.progress).toBeGreaterThanOrEqual(80)
  })

  it('cut beats litigation when both flagged', () => {
    const cv = baseCaseView({
      operational: {
        ...baseCaseView().operational,
        cutReviewIndicator: 'yes',
        litigationReviewIndicator: 'yes',
      } as any,
      caseData: { ...baseCaseView().caseData, currentStage: 'litigation' } as any,
    })
    expect(deriveTrackFromCaseView(cv).track).toBe('cut')
  })
})

// --- resolveTrackForCaseView ---------------------------------------------

describe('resolveTrackForCaseView', () => {
  it('manual override on caseData.id wins', () => {
    writeTrackOverride('user-1', 'cv-1', {
      track: 'transfer',
      reason: 'Outside our jurisdiction',
      setAt: '',
      setBy: 'user-1',
    })
    const cv = baseCaseView()
    const info = resolveTrackForCaseView(cv, 'user-1')
    expect(info.track).toBe('transfer')
    expect(info.isManualOverride).toBe(true)
  })
})

// --- TRACK_REASONS shape --------------------------------------------------

describe('TRACK_REASONS', () => {
  it('every reason is non-empty for each track', () => {
    const tracks: Exclude<CaseTrack, 'unset'>[] = ['rfd', 'litigation', 'cut', 'transfer']
    for (const t of tracks) {
      expect(TRACK_REASONS[t].length).toBeGreaterThan(0)
      for (const r of TRACK_REASONS[t]) {
        expect(r.trim().length).toBeGreaterThan(0)
      }
    }
  })

  it('reasons are unique within a track (no accidental duplicates)', () => {
    for (const list of Object.values(TRACK_REASONS)) {
      const set = new Set(list)
      expect(set.size).toBe(list.length)
    }
  })
})
