import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Phone, MessageSquare, ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  initials,
  relativeTime,
  slaDisplay,
  sortLeads,
  verdictStyle,
  tierStyle,
} from '@/lib/intakeUtils'

// --- Types -----------------------------------------------------------------

export interface IntakeLead {
  id: string
  name: string
  phone: string
  state: 'NJ' | 'NY' | 'PA' | string
  caseType: string
  source: 'phone' | 'web' | 'referral' | 'partner'
  intakeDate: string
  slaDeadline: string | null
  verdict: string | null
  valueTier:
    | 'CATASTROPHIC'
    | 'HIGH'
    | 'MEDIUM'
    | 'LOW'
    | 'MINIMAL'
    | null
  opportunityScore: number | null
  estValueRange: string | null
  assignedTo: string | null
  status:
    | 'new'
    | 'contacted'
    | 'qualifying'
    | 'agreement_sent'
    | 'signed'
    | 'rejected'
    | 'refer_out'
}

interface IntakeQueueProps {
  leads?: IntakeLead[]
}

type PresetKey =
  | 'all'
  | 'ready_to_call'
  | 'qualifying'
  | 'agreement_out'
  | 'refer_out'
  | 'rejected_7d'

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'ready_to_call', label: 'Ready to call' },
  { key: 'qualifying', label: 'Qualifying' },
  { key: 'agreement_out', label: 'Agreement out' },
  { key: 'refer_out', label: 'Refer-out queue' },
  { key: 'rejected_7d', label: 'Rejected (7-day)' },
]

const STATE_OPTIONS = ['All', 'NJ', 'NY', 'PA', 'Other']
const VERDICT_OPTIONS = [
  'All verdicts',
  'PURSUE-HARD',
  'PURSUE-STANDARD',
  'SOLID-CASE',
  'MARGINAL-PURSUE',
  'REFER-OUT-VALUE',
  'REJECT-STATUTE',
]
const SLA_OPTIONS = ['Any SLA', 'Urgent (<5m)', 'On track', 'Passed']

// --- Mock data -------------------------------------------------------------

const now = Date.now()
const iso = (msOffset: number) => new Date(now + msOffset).toISOString()

export const MOCK_LEADS: IntakeLead[] = [
  {
    id: 'INT-260212225483',
    name: 'Maria Santos',
    phone: '(201) 555-0142',
    state: 'NJ',
    caseType: 'MVA',
    source: 'phone',
    intakeDate: iso(-7 * 60 * 1000),
    slaDeadline: iso(4 * 60 * 1000 + 12 * 1000),
    verdict: 'PURSUE-HARD',
    valueTier: 'HIGH',
    opportunityScore: 92,
    estValueRange: '$40K-$150K',
    assignedTo: 'Cassandra Spanato',
    status: 'new',
  },
  {
    id: 'INT-260212225490',
    name: 'Darnell Whitfield',
    phone: '(718) 555-0231',
    state: 'NY',
    caseType: 'Premises',
    source: 'web',
    intakeDate: iso(-22 * 60 * 1000),
    slaDeadline: iso(13 * 60 * 1000),
    verdict: 'SOLID-CASE',
    valueTier: 'MEDIUM',
    opportunityScore: 74,
    estValueRange: '$25K-$60K',
    assignedTo: 'Cassandra Spanato',
    status: 'contacted',
  },
  {
    id: 'INT-260212225501',
    name: 'Priya Raman',
    phone: '(908) 555-0118',
    state: 'NJ',
    caseType: 'Slip and Fall',
    source: 'referral',
    intakeDate: iso(-2 * 60 * 60 * 1000),
    slaDeadline: iso(-12 * 60 * 1000),
    verdict: 'MARGINAL-PURSUE',
    valueTier: 'LOW',
    opportunityScore: 48,
    estValueRange: '$10K-$25K',
    assignedTo: 'Jordan Reyes',
    status: 'qualifying',
  },
  {
    id: 'INT-260212225517',
    name: 'Eamon O’Brien',
    phone: '(215) 555-0177',
    state: 'PA',
    caseType: 'MVA',
    source: 'phone',
    intakeDate: iso(-35 * 60 * 1000),
    slaDeadline: iso(3 * 60 * 1000 + 30 * 1000),
    verdict: 'PURSUE-STANDARD',
    valueTier: 'HIGH',
    opportunityScore: 81,
    estValueRange: '$30K-$90K',
    assignedTo: null,
    status: 'new',
  },
  {
    id: 'INT-260212225524',
    name: 'Tasha Greenberg',
    phone: '(646) 555-0109',
    state: 'NY',
    caseType: 'Construction',
    source: 'partner',
    intakeDate: iso(-50 * 60 * 1000),
    slaDeadline: iso(55 * 60 * 1000),
    verdict: 'CATASTROPHIC-LIFE-ALTERING',
    valueTier: 'CATASTROPHIC',
    opportunityScore: 96,
    estValueRange: '$500K-$2M',
    assignedTo: 'Cassandra Spanato',
    status: 'qualifying',
  },
  {
    id: 'INT-260212225540',
    name: 'Luis Aguilar',
    phone: '(201) 555-0166',
    state: 'NJ',
    caseType: 'Dog Bite',
    source: 'web',
    intakeDate: iso(-5 * 60 * 60 * 1000),
    slaDeadline: null,
    verdict: 'QUALIFIED-STANDARD',
    valueTier: 'MEDIUM',
    opportunityScore: 62,
    estValueRange: '$15K-$40K',
    assignedTo: 'Jordan Reyes',
    status: 'agreement_sent',
  },
  {
    id: 'INT-260212225555',
    name: 'Wendy Kowalski',
    phone: '(973) 555-0102',
    state: 'NJ',
    caseType: 'MVA',
    source: 'phone',
    intakeDate: iso(-8 * 60 * 60 * 1000),
    slaDeadline: null,
    verdict: 'REFER-OUT-VALUE',
    valueTier: 'LOW',
    opportunityScore: 22,
    estValueRange: '$3K-$8K',
    assignedTo: 'Jordan Reyes',
    status: 'refer_out',
  },
  {
    id: 'INT-260212225569',
    name: 'Brandon Yu',
    phone: '(412) 555-0188',
    state: 'PA',
    caseType: 'MVA',
    source: 'web',
    intakeDate: iso(-1 * 24 * 60 * 60 * 1000),
    slaDeadline: null,
    verdict: 'REJECT-STATUTE',
    valueTier: 'MINIMAL',
    opportunityScore: 8,
    estValueRange: null,
    assignedTo: 'Cassandra Spanato',
    status: 'rejected',
  },
]

// --- Helpers ---------------------------------------------------------------

function matchesPreset(l: IntakeLead, preset: PresetKey): boolean {
  if (preset === 'all') return true
  if (preset === 'ready_to_call') {
    if (l.status !== 'new' || !l.slaDeadline) return false
    const ms = new Date(l.slaDeadline).getTime() - Date.now()
    return ms > 0 && ms < 5 * 60 * 1000
  }
  if (preset === 'qualifying') return l.status === 'qualifying'
  if (preset === 'agreement_out') return l.status === 'agreement_sent'
  if (preset === 'refer_out') return l.status === 'refer_out'
  if (preset === 'rejected_7d') {
    if (l.status !== 'rejected') return false
    const age = Date.now() - new Date(l.intakeDate).getTime()
    return age < 7 * 24 * 60 * 60 * 1000
  }
  return true
}

function matchesSla(l: IntakeLead, filter: string): boolean {
  if (filter === 'Any SLA') return true
  const s = slaDisplay(l.slaDeadline)
  if (filter === 'Urgent (<5m)') return s.state === 'urgent'
  if (filter === 'On track') return s.state === 'ok'
  if (filter === 'Passed') return s.state === 'passed'
  return true
}

function matchesState(l: IntakeLead, filter: string): boolean {
  if (filter === 'All') return true
  if (filter === 'Other') return !['NJ', 'NY', 'PA'].includes(l.state)
  return l.state === filter
}

function matchesVerdict(l: IntakeLead, filter: string): boolean {
  if (filter === 'All verdicts') return true
  return l.verdict === filter
}

// --- Component -------------------------------------------------------------

export default function IntakeQueue({ leads = MOCK_LEADS }: IntakeQueueProps) {
  const navigate = useNavigate()
  const [preset, setPreset] = useState<PresetKey>('all')
  const [stateFilter, setStateFilter] = useState('All')
  const [verdictFilter, setVerdictFilter] = useState('All verdicts')
  const [slaFilter, setSlaFilter] = useState('Any SLA')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const rows = leads.filter(
      (l) =>
        matchesPreset(l, preset) &&
        matchesState(l, stateFilter) &&
        matchesVerdict(l, verdictFilter) &&
        matchesSla(l, slaFilter) &&
        (q === '' ||
          l.name.toLowerCase().includes(q) ||
          l.id.toLowerCase().includes(q) ||
          l.caseType.toLowerCase().includes(q)),
    )
    return sortLeads(rows)
  }, [leads, preset, stateFilter, verdictFilter, slaFilter, query])

  return (
    <div className="min-h-screen bg-[#0B0B0A] text-[#EDECE5] font-[Inter_Variable,Inter,system-ui] text-[13px] leading-[1.45]">
      <div className="mx-auto max-w-[1400px] px-6 py-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-[17px] font-semibold tracking-tight">
              Intake Queue
            </h1>
            <span className="inline-flex items-center rounded-full border border-[#26251F] bg-[#141412] px-2 py-0.5 text-[11px] font-medium text-[#8A897F]">
              {filtered.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, ID, case type"
              className="h-8 w-64 border-[#26251F] bg-[#141412] text-[13px] placeholder:text-[#8A897F]"
            />
          </div>
        </div>

        {/* Preset row */}
        <div className="mt-4 flex flex-wrap items-center gap-1">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPreset(p.key)}
              className={cn(
                'h-7 rounded-md border px-2.5 text-[12px] font-medium transition-colors',
                preset === p.key
                  ? 'border-[#26251F] bg-[#1B1930] text-[#EDECE5]'
                  : 'border-transparent text-[#8A897F] hover:bg-[#141412] hover:text-[#EDECE5]',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Secondary filters */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <FilterSelect
            label={stateFilter}
            value={stateFilter}
            onChange={setStateFilter}
            options={STATE_OPTIONS}
          />
          <FilterSelect
            label={verdictFilter}
            value={verdictFilter}
            onChange={setVerdictFilter}
            options={VERDICT_OPTIONS}
          />
          <FilterSelect
            label={slaFilter}
            value={slaFilter}
            onChange={setSlaFilter}
            options={SLA_OPTIONS}
          />
        </div>

        {/* Table */}
        <div className="mt-4 overflow-hidden rounded-lg border border-[#26251F] bg-[#141412]">
          <div className="grid grid-cols-[minmax(220px,1.6fr)_70px_90px_110px_minmax(160px,1.2fr)_150px_110px_70px_120px] items-center gap-3 border-b border-[#26251F] px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-[#8A897F]">
            <div>Lead</div>
            <div>State</div>
            <div>Source</div>
            <div>Intake</div>
            <div>Verdict</div>
            <div>Opportunity</div>
            <div>SLA</div>
            <div>Owner</div>
            <div className="text-right">Actions</div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState />
          ) : (
            filtered.map((lead) => (
              <LeadRow
                key={lead.id}
                lead={lead}
                onOpen={() => navigate(`/intake/${lead.id}`)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// --- Sub-components --------------------------------------------------------

function LeadRow({ lead, onOpen }: { lead: IntakeLead; onOpen: () => void }) {
  const sla = slaDisplay(lead.slaDeadline)
  const vStyle = verdictStyle(lead.verdict)
  const tStyle = tierStyle(lead.valueTier)
  const score = lead.opportunityScore ?? 0

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen()
      }}
      className="group grid h-9 cursor-pointer grid-cols-[minmax(220px,1.6fr)_70px_90px_110px_minmax(160px,1.2fr)_150px_110px_70px_120px] items-center gap-3 border-b border-[#26251F] px-4 text-[13px] hover:bg-[#1A1915] focus:bg-[#1A1915] focus:outline-none last:border-0"
    >
      {/* Name + case type */}
      <div className="min-w-0">
        <div className="truncate font-semibold text-[#EDECE5]">{lead.name}</div>
        <div className="truncate text-[11px] text-[#8A897F]">
          {lead.caseType}
        </div>
      </div>

      {/* State */}
      <div>
        <span className="inline-flex h-5 items-center rounded-full border border-[#26251F] bg-[#1B1A17] px-2 text-[11px] font-medium text-[#8A897F]">
          {lead.state}
        </span>
      </div>

      {/* Source */}
      <div className="truncate text-[#8A897F] capitalize">{lead.source}</div>

      {/* Intake date */}
      <div className="font-mono text-[12px] text-[#8A897F]">
        {relativeTime(lead.intakeDate)}
      </div>

      {/* Verdict */}
      <div>
        {lead.verdict ? (
          <span
            className={cn(
              'inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium',
              vStyle.badge,
            )}
          >
            {lead.verdict}
          </span>
        ) : (
          <span className="text-[#8A897F]">—</span>
        )}
      </div>

      {/* Opportunity score */}
      <div className="flex items-center gap-2">
        <div className="h-1 w-20 overflow-hidden rounded-full bg-[#26251F]">
          <div
            className={cn('h-full rounded-full', tStyle.bar)}
            style={{ width: `${Math.max(2, score)}%` }}
          />
        </div>
        <span className="w-7 text-right font-mono text-[12px] tabular-nums text-[#EDECE5]">
          {lead.opportunityScore ?? '—'}
        </span>
      </div>

      {/* SLA */}
      <div
        className={cn(
          'font-mono text-[12px] tabular-nums',
          sla.state === 'urgent' && 'text-[#6B8DFF]',
          sla.state === 'ok' && 'text-[#EDECE5]',
          (sla.state === 'passed' || sla.state === 'none') && 'text-[#8A897F]',
        )}
      >
        {sla.label}
      </div>

      {/* Owner avatar */}
      <div>
        {lead.assignedTo ? (
          <div
            title={lead.assignedTo}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-[#26251F] bg-[#1B1A17] text-[10px] font-semibold text-[#EDECE5]"
          >
            {initials(lead.assignedTo)}
          </div>
        ) : (
          <span className="text-[#8A897F]">—</span>
        )}
      </div>

      {/* Row actions (reveal on hover) */}
      <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100">
        <RowIconButton
          label="Call"
          onClick={(e) => {
            e.stopPropagation()
            window.location.href = `tel:${lead.phone}`
          }}
        >
          <Phone className="h-3.5 w-3.5" />
        </RowIconButton>
        <RowIconButton
          label="Message"
          onClick={(e) => {
            e.stopPropagation()
            window.location.href = `sms:${lead.phone}`
          }}
        >
          <MessageSquare className="h-3.5 w-3.5" />
        </RowIconButton>
        <RowIconButton
          label="Open"
          onClick={(e) => {
            e.stopPropagation()
            onOpen()
          }}
        >
          <ArrowUpRight className="h-3.5 w-3.5" />
        </RowIconButton>
      </div>
    </div>
  )
}

function RowIconButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode
  label: string
  onClick: (e: React.MouseEvent) => void
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className="flex h-6 w-6 items-center justify-center rounded-md border border-[#26251F] bg-[#141412] text-[#8A897F] hover:bg-[#1B1930] hover:text-[#EDECE5]"
    >
      {children}
    </button>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: string[]
}) {
  return (
    <Select value={value} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger className="h-7 min-w-[120px] border-[#26251F] bg-[#141412] px-2 text-[12px] text-[#EDECE5]">
        <span className="truncate">{label}</span>
      </SelectTrigger>
      <SelectContent className="border-[#26251F] bg-[#141412] text-[13px] text-[#EDECE5]">
        {options.map((opt) => (
          <SelectItem key={opt} value={opt}>
            {opt}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="text-[13px] text-[#EDECE5]">No leads in queue</div>
      <div className="mt-1 text-[12px] text-[#8A897F]">
        New leads will appear here automatically.
      </div>
      <Button
        variant="outline"
        size="sm"
        className="mt-4 border-[#26251F] bg-[#141412] text-[#EDECE5] hover:bg-[#1B1930]"
        onClick={() => window.location.reload()}
      >
        Refresh
      </Button>
    </div>
  )
}
