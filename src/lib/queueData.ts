/**
 * Shared queue assembly — used by the full /queue page, /queue/run mode,
 * and the sidebar MiniQueue. Currently merges demo fixtures; will swap to
 * live data fetch once cases land in the API.
 */

import {
  RANKER_DEMO_CASES,
  rankCases,
  type CaseForRanking,
  type RankedCase,
} from './callQueueRanker'

const MS_PER_DAY = 24 * 60 * 60 * 1000
const MS_PER_HOUR = 60 * 60 * 1000

function offsetIso(ms: number, anchor: Date): string {
  return new Date(anchor.getTime() + ms).toISOString()
}

function buildExtraDemoCases(anchor: Date): CaseForRanking[] {
  return [
    {
      id: 'CASE-MARIA-SANTOS',
      clientName: 'Maria Santos',
      caseType: 'MVA',
      estValue: 150_000,
      slaDeadline: offsetIso(3 * MS_PER_HOUR + 14 * 60 * 1000, anchor),
      lastContactAt: offsetIso(-9 * MS_PER_DAY, anchor),
      lastTreatmentEventAt: offsetIso(-6 * MS_PER_DAY, anchor),
      redSignals: ['Awaiting MRI authorization', 'Client hesitation on last call'],
      openAction: 'Confirm MRI scheduling',
      verdict: 'PURSUE-HARD',
    },
    {
      id: 'CASE-260101',
      clientName: 'Jade Nakamura',
      caseType: 'Slip and Fall',
      estValue: 42_000,
      slaDeadline: null,
      lastContactAt: offsetIso(-6 * MS_PER_DAY, anchor),
      lastTreatmentEventAt: offsetIso(-11 * MS_PER_DAY, anchor),
      redSignals: [],
      openAction: 'PT status check',
      verdict: 'SOLID-CASE',
    },
  ]
}

export function assembleQueueCases(anchor: Date = new Date()): CaseForRanking[] {
  const byId = new Map<string, CaseForRanking>()
  for (const c of RANKER_DEMO_CASES) byId.set(c.id, c)
  for (const c of buildExtraDemoCases(anchor)) byId.set(c.id, c)
  return Array.from(byId.values())
}

export function getRankedQueue(anchor: Date = new Date()): RankedCase[] {
  return rankCases(assembleQueueCases(anchor), anchor)
}
