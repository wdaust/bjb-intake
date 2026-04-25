import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Phone,
  Target,
  Gavel,
  XCircle,
  ArrowRightLeft,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getCaseManagers } from '@/data/liveData'

/**
 * Demo CM-day fixture. Mirrors the daily reporting requirements in the
 * CHAOS notes (call volume, avg talk time, advancement metrics, contact %).
 * Will be replaced by an aggregate query once `calls` + `case_tracks` are
 * populated server-side.
 */
interface CmDayRow {
  cmId: string
  name: string
  callsCompleted: number
  callsTarget: number
  contactRatePct: number
  avgTalkMinutes: number
  rfdAdvances: number
  litigationAdvances: number
  cuts: number
  transfers: number
  topReasonChip: string
  callQualityAvg: number
}

/**
 * Per-CM activity profile. Daily volumes vary by CM workload (caseCount).
 * Each profile is deterministic from the CM id so the same CM gets the
 * same demo numbers across renders.
 */
const ACTIVITY_PROFILES: Array<Omit<CmDayRow, 'cmId' | 'name'>> = [
  {
    callsCompleted: 14,
    callsTarget: 16,
    contactRatePct: 79,
    avgTalkMinutes: 9,
    rfdAdvances: 3,
    litigationAdvances: 1,
    cuts: 0,
    transfers: 0,
    topReasonChip: 'Treatment near MMI',
    callQualityAvg: 86,
  },
  {
    callsCompleted: 11,
    callsTarget: 16,
    contactRatePct: 64,
    avgTalkMinutes: 12,
    rfdAdvances: 2,
    litigationAdvances: 2,
    cuts: 1,
    transfers: 0,
    topReasonChip: 'Multi-defendant exposure',
    callQualityAvg: 82,
  },
  {
    callsCompleted: 17,
    callsTarget: 16,
    contactRatePct: 88,
    avgTalkMinutes: 7,
    rfdAdvances: 5,
    litigationAdvances: 0,
    cuts: 0,
    transfers: 1,
    topReasonChip: 'Demand-ready',
    callQualityAvg: 91,
  },
  {
    callsCompleted: 9,
    callsTarget: 16,
    contactRatePct: 56,
    avgTalkMinutes: 10,
    rfdAdvances: 1,
    litigationAdvances: 1,
    cuts: 1,
    transfers: 1,
    topReasonChip: 'Statute of limitations lapsed',
    callQualityAvg: 74,
  },
  {
    callsCompleted: 13,
    callsTarget: 16,
    contactRatePct: 72,
    avgTalkMinutes: 8,
    rfdAdvances: 2,
    litigationAdvances: 0,
    cuts: 0,
    transfers: 0,
    topReasonChip: 'Standard MVA path',
    callQualityAvg: 88,
  },
]

function hashCmId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h << 5) - h + id.charCodeAt(i)
  return Math.abs(h)
}

function buildCmDay(cmId: string, name: string): CmDayRow {
  const profile = ACTIVITY_PROFILES[hashCmId(cmId) % ACTIVITY_PROFILES.length]!
  return { ...profile, cmId, name }
}

type SortKey =
  | 'name'
  | 'callsCompleted'
  | 'contactRatePct'
  | 'avgTalkMinutes'
  | 'rfdAdvances'
  | 'litigationAdvances'
  | 'cuts'
  | 'transfers'
  | 'callQualityAvg'

// Fallback names if Litify CM list isn't available (offline / no auth).
const FALLBACK_NAMES = [
  'Cassandra Spanato',
  'Jess Rivera',
  'Malcolm Greene',
  'Priya Anand',
  'Derrick Olusanya',
]

export function DailyCmReport() {
  const [sortKey, setSortKey] = useState<SortKey>('callsCompleted')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [cmRows, setCmRows] = useState<CmDayRow[]>(() =>
    FALLBACK_NAMES.map((name, i) => buildCmDay(`fallback-${i}`, name)),
  )

  // Pull real CMs from Litify when available; show top 8 by caseCount.
  useEffect(() => {
    let cancelled = false
    getCaseManagers().then((cms) => {
      if (cancelled || cms.length === 0) return
      const top = cms.slice(0, 8).map((c) => buildCmDay(c.id, c.name))
      setCmRows(top)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const rows = useMemo(() => {
    const copy = [...cmRows]
    copy.sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av
      }
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av))
    })
    return copy
  }, [sortKey, sortDir, cmRows])

  const totals = useMemo(() => {
    return cmRows.reduce(
      (acc, r) => ({
        callsCompleted: acc.callsCompleted + r.callsCompleted,
        callsTarget: acc.callsTarget + r.callsTarget,
        avgTalkMinutes: acc.avgTalkMinutes + r.avgTalkMinutes,
        rfdAdvances: acc.rfdAdvances + r.rfdAdvances,
        litigationAdvances: acc.litigationAdvances + r.litigationAdvances,
        cuts: acc.cuts + r.cuts,
        transfers: acc.transfers + r.transfers,
      }),
      {
        callsCompleted: 0,
        callsTarget: 0,
        avgTalkMinutes: 0,
        rfdAdvances: 0,
        litigationAdvances: 0,
        cuts: 0,
        transfers: 0,
      },
    )
  }, [cmRows])

  const avgTalk = Math.round(totals.avgTalkMinutes / Math.max(1, cmRows.length))
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })

  function toggleSort(k: SortKey) {
    if (sortKey === k) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(k)
      setSortDir('desc')
    }
  }

  return (
    <div className="space-y-4">
      {/* Summary tiles */}
      <div className="grid grid-cols-6 gap-3">
        <SummaryTile
          label="Calls today"
          value={`${totals.callsCompleted}/${totals.callsTarget}`}
          sub={`${Math.round((totals.callsCompleted / totals.callsTarget) * 100)}% of target`}
          icon={Phone}
        />
        <SummaryTile
          label="Avg talk time"
          value={`${avgTalk}m`}
          sub="across active CMs"
          icon={Phone}
        />
        <SummaryTile
          label="RFD advances"
          value={String(totals.rfdAdvances)}
          sub="cases moved toward demand"
          icon={Target}
          tone="text-emerald-300"
        />
        <SummaryTile
          label="Litigation"
          value={String(totals.litigationAdvances)}
          sub="re-tracked cases"
          icon={Gavel}
          tone="text-violet-300"
        />
        <SummaryTile
          label="Cuts"
          value={String(totals.cuts)}
          sub="disqualified today"
          icon={XCircle}
          tone="text-red-300"
        />
        <SummaryTile
          label="Transfers"
          value={String(totals.transfers)}
          sub="referred out"
          icon={ArrowRightLeft}
          tone="text-amber-300"
        />
      </div>

      {/* Per-CM table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base">
            <span>Per-CM activity · {today}</span>
            <span className="text-[11px] font-normal text-muted-foreground">
              Click a column header to sort
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <SortableTh
                    label="CM"
                    keyName="name"
                    activeKey={sortKey}
                    dir={sortDir}
                    onClick={toggleSort}
                    className="text-left"
                  />
                  <SortableTh
                    label="Calls"
                    keyName="callsCompleted"
                    activeKey={sortKey}
                    dir={sortDir}
                    onClick={toggleSort}
                  />
                  <SortableTh
                    label="Contact %"
                    keyName="contactRatePct"
                    activeKey={sortKey}
                    dir={sortDir}
                    onClick={toggleSort}
                  />
                  <SortableTh
                    label="Avg talk"
                    keyName="avgTalkMinutes"
                    activeKey={sortKey}
                    dir={sortDir}
                    onClick={toggleSort}
                  />
                  <SortableTh
                    label="RFD"
                    keyName="rfdAdvances"
                    activeKey={sortKey}
                    dir={sortDir}
                    onClick={toggleSort}
                  />
                  <SortableTh
                    label="Litigation"
                    keyName="litigationAdvances"
                    activeKey={sortKey}
                    dir={sortDir}
                    onClick={toggleSort}
                  />
                  <SortableTh
                    label="Cuts"
                    keyName="cuts"
                    activeKey={sortKey}
                    dir={sortDir}
                    onClick={toggleSort}
                  />
                  <SortableTh
                    label="Transfers"
                    keyName="transfers"
                    activeKey={sortKey}
                    dir={sortDir}
                    onClick={toggleSort}
                  />
                  <SortableTh
                    label="Call quality"
                    keyName="callQualityAvg"
                    activeKey={sortKey}
                    dir={sortDir}
                    onClick={toggleSort}
                  />
                  <th className="px-2 py-2 text-left">Top reason today</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const callsPct = (r.callsCompleted / r.callsTarget) * 100
                  return (
                    <tr
                      key={r.cmId}
                      className="border-b border-border last:border-0 hover:bg-card/40"
                    >
                      <td className="px-2 py-2 font-medium">{r.name}</td>
                      <td className="px-2 py-2 text-center">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 font-mono',
                            callsPct >= 100
                              ? 'text-emerald-300'
                              : callsPct >= 80
                              ? 'text-foreground'
                              : 'text-amber-300',
                          )}
                        >
                          {r.callsCompleted}/{r.callsTarget}
                          {callsPct >= 100 && <ArrowUpRight className="h-3 w-3" />}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-center font-mono">
                        {r.contactRatePct}%
                      </td>
                      <td className="px-2 py-2 text-center font-mono">
                        {r.avgTalkMinutes}m
                      </td>
                      <td className="px-2 py-2 text-center font-mono text-emerald-300">
                        {r.rfdAdvances}
                      </td>
                      <td className="px-2 py-2 text-center font-mono text-violet-300">
                        {r.litigationAdvances}
                      </td>
                      <td className="px-2 py-2 text-center font-mono text-red-300">
                        {r.cuts}
                      </td>
                      <td className="px-2 py-2 text-center font-mono text-amber-300">
                        {r.transfers}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <QualityPill score={r.callQualityAvg} />
                      </td>
                      <td className="px-2 py-2 text-[12px] text-muted-foreground">
                        {r.topReasonChip}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

interface SummaryTileProps {
  label: string
  value: string
  sub: string
  icon: React.ComponentType<{ className?: string }>
  tone?: string
}

function SummaryTile({ label, value, sub, icon: Icon, tone }: SummaryTileProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          <Icon className={cn('h-4 w-4 text-muted-foreground', tone)} />
        </div>
        <div className={cn('text-2xl font-bold', tone)}>{value}</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>
      </CardContent>
    </Card>
  )
}

interface SortableThProps {
  label: string
  keyName: SortKey
  activeKey: SortKey
  dir: 'asc' | 'desc'
  onClick: (k: SortKey) => void
  className?: string
}

function SortableTh({
  label,
  keyName,
  activeKey,
  dir,
  onClick,
  className,
}: SortableThProps) {
  const active = activeKey === keyName
  const Arrow = dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <th
      className={cn(
        'cursor-pointer px-2 py-2 text-center font-medium hover:text-foreground',
        active && 'text-foreground',
        className,
      )}
      onClick={() => onClick(keyName)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && <Arrow className="h-3 w-3" />}
      </span>
    </th>
  )
}

function QualityPill({ score }: { score: number }) {
  const tone =
    score >= 90
      ? 'border-emerald-700/40 bg-emerald-900/20 text-emerald-300'
      : score >= 80
      ? 'border-sky-700/40 bg-sky-900/20 text-sky-300'
      : score >= 70
      ? 'border-amber-700/40 bg-amber-900/20 text-amber-300'
      : 'border-red-700/40 bg-red-900/20 text-red-300'
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-full border px-1.5 font-mono text-[11px]',
        tone,
      )}
    >
      {score}
    </span>
  )
}
