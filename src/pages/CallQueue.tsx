import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Activity,
  AlertTriangle,
  CalendarOff,
  Clock,
  DollarSign,
  GripVertical,
  Info,
  MoreHorizontal,
  Play,
  Search,
  Sparkles,
  TrendingDown,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import {
  rankCases,
  RANKER_DEMO_CASES,
  RANKER_DEMO_NOW,
  type CaseForRanking,
  type PriorityTier,
  type RankedCase,
  type ReasonChip,
} from '@/lib/callQueueRanker'
import { useAuth } from '@/lib/AuthContext'
import { cn } from '@/lib/utils'
import { resolveCaseTrack } from '@/lib/caseTrack'
import { TrackChip } from '@/components/case/TrackChip'
import { TrackPicker } from '@/components/case/TrackPicker'

// -----------------------------------------------------------------------------
// Filter chips
// -----------------------------------------------------------------------------

type FilterKey = 'today' | 'week' | 'sla_risk' | 'high_value' | 'stale'

interface FilterDef {
  key: FilterKey
  label: string
}

const FILTERS: FilterDef[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'sla_risk', label: 'SLA risk' },
  { key: 'high_value', label: 'High value' },
  { key: 'stale', label: 'Stale >7d' },
]

// -----------------------------------------------------------------------------
// Sort keys
// -----------------------------------------------------------------------------

type SortKey = 'ai' | 'sla' | 'value' | 'contact' | 'custom'

const SORT_LABELS: Record<SortKey, string> = {
  ai: 'AI Priority',
  sla: 'SLA Deadline',
  value: 'Case Value',
  contact: 'Last Contact',
  custom: 'Custom Order',
}

// -----------------------------------------------------------------------------
// Extra demo cases pulled from existing mocks (matches the "merge with Maria +
// Caseload mock cases" brief). Kept local so this page renders before the other
// agents wire real data.
// -----------------------------------------------------------------------------

const MS_PER_DAY = 24 * 60 * 60 * 1000
const MS_PER_HOUR = 60 * 60 * 1000
function offsetIso(ms: number): string {
  return new Date(RANKER_DEMO_NOW.getTime() + ms).toISOString()
}

const EXTRA_DEMO_CASES: CaseForRanking[] = [
  {
    id: 'CASE-MARIA-SANTOS',
    clientName: 'Maria Santos',
    caseType: 'MVA',
    estValue: 150_000,
    slaDeadline: offsetIso(3 * MS_PER_HOUR + 14 * 60 * 1000),
    lastContactAt: offsetIso(-9 * MS_PER_DAY),
    lastTreatmentEventAt: offsetIso(-6 * MS_PER_DAY),
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
    lastContactAt: offsetIso(-6 * MS_PER_DAY),
    lastTreatmentEventAt: offsetIso(-11 * MS_PER_DAY),
    redSignals: [],
    openAction: 'PT status check',
    verdict: 'SOLID-CASE',
  },
]

function assembleCases(): CaseForRanking[] {
  // Dedup by id — Maria might live in either source.
  const byId = new Map<string, CaseForRanking>()
  for (const c of RANKER_DEMO_CASES) byId.set(c.id, c)
  for (const c of EXTRA_DEMO_CASES) byId.set(c.id, c)
  return Array.from(byId.values())
}

// -----------------------------------------------------------------------------
// Main page
// -----------------------------------------------------------------------------

export default function CallQueue() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const userKey = user?.uid || 'default'
  const orderStorageKey = `caos:queue:${userKey}:order`
  const snoozeStorageKey = `caos:queue:${userKey}:snooze`

  // --- Rank once on mount --------------------------------------------------
  const ranked = useMemo<RankedCase[]>(() => {
    return rankCases(assembleCases(), new Date())
  }, [])

  // Track override revision — bumped via custom event so all rows re-resolve.
  const [trackRevision, setTrackRevision] = useState(0)
  useEffect(() => {
    function onChange() {
      setTrackRevision((r) => r + 1)
    }
    window.addEventListener('caos:track-override', onChange)
    return () => window.removeEventListener('caos:track-override', onChange)
  }, [])

  // --- Filter state --------------------------------------------------------
  const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(
    () => new Set<FilterKey>(['today']),
  )
  const [sortKey, setSortKey] = useState<SortKey>('ai')
  const [query, setQuery] = useState('')

  function toggleFilter(k: FilterKey) {
    setActiveFilters((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }

  // --- Snooze state --------------------------------------------------------
  const [snoozeMap, setSnoozeMap] = useState<Record<string, string>>(() => {
    if (typeof window === 'undefined') return {}
    try {
      const raw = window.localStorage.getItem(snoozeStorageKey)
      if (!raw) return {}
      const parsed = JSON.parse(raw) as unknown
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, string>
      }
      return {}
    } catch {
      return {}
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(snoozeStorageKey, JSON.stringify(snoozeMap))
    } catch {
      /* ignore */
    }
  }, [snoozeMap, snoozeStorageKey])

  function snoozeCase(id: string, until: Date) {
    setSnoozeMap((prev) => ({ ...prev, [id]: until.toISOString() }))
  }

  // --- Custom order (persisted) -------------------------------------------
  const [customOrder, setCustomOrder] = useState<string[] | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const raw = window.localStorage.getItem(orderStorageKey)
      if (!raw) return null
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
        return parsed as string[]
      }
      return null
    } catch {
      return null
    }
  })

  useEffect(() => {
    try {
      if (customOrder && customOrder.length > 0) {
        window.localStorage.setItem(orderStorageKey, JSON.stringify(customOrder))
      } else {
        window.localStorage.removeItem(orderStorageKey)
      }
    } catch {
      /* ignore */
    }
  }, [customOrder, orderStorageKey])

  // If a custom order exists on mount, reflect it in the sort dropdown.
  useEffect(() => {
    if (customOrder && customOrder.length > 0) {
      setSortKey('custom')
    }
    // Intentionally mount-only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function resetToAiOrder() {
    setCustomOrder(null)
    setSortKey('ai')
  }

  // --- Compute the visible list ------------------------------------------
  const now = Date.now()

  const visible = useMemo(() => {
    const byId = new Map<string, RankedCase>()
    for (const c of ranked) byId.set(c.id, c)

    // 1) Remove snoozed cases whose time hasn't passed.
    let list = ranked.filter((c) => {
      const until = snoozeMap[c.id]
      if (!until) return true
      return new Date(until).getTime() <= now
    })

    // 2) Filter chips (additive).
    if (activeFilters.size > 0) {
      list = list.filter((c) => {
        for (const f of activeFilters) {
          if (!matchesFilter(c, f, now)) return false
        }
        return true
      })

      // "Today" and "This week" cap the list length per the spec.
      if (activeFilters.has('today') && !activeFilters.has('week')) {
        // Top 12-ish: critical + high + some medium from the ranker.
        const cap = list.filter(
          (c) =>
            c.priorityTier === 'critical' ||
            c.priorityTier === 'high' ||
            c.priorityTier === 'medium',
        )
        list = cap.slice(0, 12)
      } else if (activeFilters.has('week')) {
        list = list.slice(0, 30)
      }
    }

    // 3) Search.
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter((c) => c.clientName.toLowerCase().includes(q))
    }

    // 4) Sort.
    if (sortKey === 'custom' && customOrder && customOrder.length > 0) {
      const orderIndex = new Map(customOrder.map((id, i) => [id, i]))
      list = [...list].sort((a, b) => {
        const ai = orderIndex.get(a.id) ?? Number.POSITIVE_INFINITY
        const bi = orderIndex.get(b.id) ?? Number.POSITIVE_INFINITY
        if (ai !== bi) return ai - bi
        return a.rank - b.rank
      })
    } else if (sortKey === 'sla') {
      list = [...list].sort((a, b) => slaMs(a) - slaMs(b))
    } else if (sortKey === 'value') {
      list = [...list].sort((a, b) => (b.estValue ?? 0) - (a.estValue ?? 0))
    } else if (sortKey === 'contact') {
      list = [...list].sort((a, b) => contactMs(a) - contactMs(b))
    } else {
      // 'ai' — already in ranker order via .rank
      list = [...list].sort((a, b) => a.rank - b.rank)
    }

    return list
  }, [ranked, snoozeMap, activeFilters, query, sortKey, customOrder, now])

  // --- Drag sensors --------------------------------------------------------
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return

    const ids = visible.map((c) => c.id)
    const fromIdx = ids.indexOf(String(active.id))
    const toIdx = ids.indexOf(String(over.id))
    if (fromIdx < 0 || toIdx < 0) return

    const reordered = arrayMove(ids, fromIdx, toIdx)
    setCustomOrder(reordered)
    setSortKey('custom')
  }

  // --- Render --------------------------------------------------------------
  const itemIds = visible.map((c) => c.id)

  return (
    <div className="flex min-h-full flex-col bg-background text-foreground">
      {/* Top bar */}
      <div
        className={cn(
          'sticky top-12 z-40 flex h-10 items-center justify-between border-b border-border px-4',
          'bg-background',
        )}
      >
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold tracking-tight">
            {todayLabel(activeFilters)}
          </span>
          <span className="inline-flex h-5 items-center rounded-full border border-border bg-card px-2 text-[11px] font-medium text-muted-foreground">
            {visible.length} queued
          </span>
        </div>
        <Button
          size="sm"
          className="h-7 gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
          render={<Link to="/queue/run?start=0" />}
        >
          <Play className="h-3.5 w-3.5" />
          Start Queue
        </Button>
      </div>

      {/* Filter bar */}
      <div
        className={cn(
          'sticky top-[88px] z-30 flex h-11 items-center gap-3 border-b border-border px-4',
          'bg-background',
        )}
      >
        <div className="flex flex-wrap items-center gap-1">
          {FILTERS.map((f) => {
            const active = activeFilters.has(f.key)
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => toggleFilter(f.key)}
                className={cn(
                  'inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[12px] font-medium transition-colors',
                  active
                    ? 'border-ring/30 bg-ring/10 text-ring'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground',
                )}
              >
                {f.label}
                {active && <X className="h-3 w-3" />}
              </button>
            )
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Sort
          </span>
          <Select
            value={sortKey}
            onValueChange={(v) => {
              if (!v) return
              setSortKey(v as SortKey)
            }}
          >
            <SelectTrigger className="h-7 min-w-[140px] border-border bg-card px-2 text-[12px]">
              <span className="truncate">{SORT_LABELS[sortKey]}</span>
            </SelectTrigger>
            <SelectContent className="border-border bg-card text-[13px]">
              <SelectItem value="ai">AI Priority</SelectItem>
              <SelectItem value="sla">SLA Deadline</SelectItem>
              <SelectItem value="value">Case Value</SelectItem>
              <SelectItem value="contact">Last Contact</SelectItem>
              <SelectItem value="custom">Custom Order</SelectItem>
            </SelectContent>
          </Select>

          {(sortKey === 'custom' ||
            (customOrder && customOrder.length > 0)) && (
            <button
              type="button"
              onClick={resetToAiOrder}
              className="text-[12px] text-ring hover:underline"
            >
              Reset to AI order
            </button>
          )}

          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="h-7 w-48 border-border bg-card pl-7 text-[12px]"
            />
          </div>
        </div>
      </div>

      {/* AI Queue Builder explainer (shows when AI sort active) */}
      {sortKey === 'ai' && <AiBuilderBanner />}

      {/* Queue list */}
      <div className="flex-1 px-4 py-3">
        {visible.length === 0 ? (
          <EmptyState />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
              <ul className="overflow-hidden rounded-lg border border-border bg-card">
                {visible.map((c, i) => (
                  <QueueRow
                    key={c.id}
                    ranked={c}
                    displayRank={i + 1}
                    userKey={userKey}
                    trackRevision={trackRevision}
                    onOpen={() => navigate(`/case-demo/${c.id}`)}
                    onSnooze={(d) => snoozeCase(c.id, d)}
                    onRemove={() => {
                      // "Remove from queue" snoozes indefinitely (30 days) for demo.
                      snoozeCase(
                        c.id,
                        new Date(Date.now() + 30 * MS_PER_DAY),
                      )
                    }}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Queue row
// -----------------------------------------------------------------------------

interface QueueRowProps {
  ranked: RankedCase
  displayRank: number
  onOpen: () => void
  onSnooze: (until: Date) => void
  onRemove: () => void
  userKey: string
  trackRevision: number
}

function QueueRow({
  ranked: c,
  displayRank,
  onOpen,
  onSnooze,
  onRemove,
  userKey,
  trackRevision,
}: QueueRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: c.id })

  // While dragging, lift to z-20 so the ghost is visible above its
  // siblings — but stays below the sticky bars (which are z-30/z-40)
  // so it can't cover the header or filter row.
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 20 : undefined,
    position: isDragging ? 'relative' : undefined,
  }

  const [snoozeOpen, setSnoozeOpen] = useState(false)
  const [trackOpen, setTrackOpen] = useState(false)
  // Re-resolve track on revision bump so the chip reflects the new override.
  const trackInfo = useMemo(
    () => resolveCaseTrack(c, userKey),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [c, userKey, trackRevision],
  )

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative flex h-14 items-center gap-3 border-b border-border px-3 transition-colors',
        'hover:bg-accent/30 last:border-0',
        isDragging && 'bg-accent/40',
      )}
      onClick={(e) => {
        // Ignore clicks on controls.
        const target = e.target as HTMLElement
        if (target.closest('[data-row-control]')) return
        onOpen()
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen()
      }}
    >
      {/* Drag handle */}
      <button
        type="button"
        data-row-control
        aria-label="Drag to reorder"
        className={cn(
          'flex h-6 w-5 shrink-0 cursor-grab items-center justify-center text-muted-foreground',
          'opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing',
        )}
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Rank chip + AI score */}
      <div className="flex shrink-0 items-center gap-1.5">
        <span
          className={cn(
            'inline-flex h-6 w-8 items-center justify-center rounded-md font-mono text-[11px]',
            tierChipClass(c.priorityTier),
          )}
        >
          #{displayRank}
        </span>
        <span
          className="inline-flex h-6 items-center gap-1 rounded-md border border-border bg-card px-1.5 font-mono text-[10px] text-muted-foreground"
          title={`AI score: ${c.aiScore}/100 (priority: ${c.priorityTier})`}
        >
          <Sparkles className="h-3 w-3 text-ring" />
          {c.aiScore}
        </span>
      </div>

      {/* Avatar */}
      <Avatar className="h-7 w-7 shrink-0 rounded-full">
        <AvatarFallback className="bg-muted text-[11px] font-medium text-foreground">
          {initialsOf(c.clientName)}
        </AvatarFallback>
      </Avatar>

      {/* Name + case id */}
      <div className="min-w-0 shrink-0 basis-[180px]">
        <div className="truncate text-[13px] font-medium text-foreground">
          {c.clientName}
        </div>
        <div className="truncate font-mono text-[11px] text-muted-foreground">
          {c.id}
        </div>
      </div>

      {/* Track chip — where this case is heading. Click to override. */}
      <Popover open={trackOpen} onOpenChange={setTrackOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              data-row-control
              onClick={(e) => {
                e.stopPropagation()
                setTrackOpen(true)
              }}
              className="shrink-0 outline-none"
              title={
                trackInfo.isManualOverride
                  ? `Set by CM: ${trackInfo.reason}`
                  : `AI-derived: ${trackInfo.reason}`
              }
            >
              <TrackChip info={trackInfo} />
            </button>
          }
        />
        <PopoverContent
          align="start"
          className="w-auto p-2"
          onClick={(e) => e.stopPropagation()}
        >
          <TrackPicker
            caseId={c.id}
            userKey={userKey}
            current={trackInfo}
            onClose={() => setTrackOpen(false)}
          />
        </PopoverContent>
      </Popover>

      {/* Reason chips */}
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        {c.reasonChips.map((chip) => (
          <ReasonPill key={`${chip.kind}-${chip.label}`} chip={chip} />
        ))}
      </div>

      {/* Row menu */}
      <div className="ml-auto flex shrink-0 items-center" data-row-control>
        {/* Snooze popover trigger lives here but menu triggers it imperatively. */}
        <Popover open={snoozeOpen} onOpenChange={setSnoozeOpen}>
          <PopoverTrigger
            render={<span aria-hidden className="h-0 w-0 p-0" />}
          />
          <PopoverContent
            align="end"
            className="w-64"
            onClick={(e) => e.stopPropagation()}
          >
            <SnoozePicker
              onPick={(d) => {
                onSnooze(d)
                setSnoozeOpen(false)
              }}
            />
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label="Row actions"
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground"
                onClick={(e) => e.stopPropagation()}
              />
            }
          >
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={onOpen}>Open case</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSnoozeOpen(true)}>
              Snooze…
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onRemove}>
              Remove from queue
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onOpen}>Add note</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  )
}

// -----------------------------------------------------------------------------
// AI Queue Builder banner — explains how the AI ordered the list
// -----------------------------------------------------------------------------

const AI_WEIGHT_LEGEND: { label: string; pct: number; tone: string }[] = [
  { label: 'SLA urgency', pct: 35, tone: 'text-red-300' },
  { label: 'Case value', pct: 20, tone: 'text-emerald-300' },
  { label: 'Stale contact', pct: 15, tone: 'text-amber-300' },
  { label: 'Treatment gap', pct: 15, tone: 'text-sky-300' },
  { label: 'Client risk', pct: 10, tone: 'text-violet-300' },
  { label: 'Momentum', pct: 5, tone: 'text-muted-foreground' },
]

function AiBuilderBanner() {
  return (
    <div className="border-b border-border bg-card/40 px-4 py-2">
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="inline-flex items-center gap-1 rounded-full border border-ring/40 bg-ring/10 px-2 py-0.5 text-ring">
          <Sparkles className="h-3 w-3" />
          <span className="font-medium">AI Queue Builder</span>
        </span>
        <span className="text-muted-foreground">
          Ranked by signals — drag any row to override.
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1">
          {AI_WEIGHT_LEGEND.map((w) => (
            <span key={w.label} className="inline-flex items-center gap-1">
              <span className={cn('font-mono text-[10px]', w.tone)}>
                {w.pct}%
              </span>
              <span className="text-muted-foreground">{w.label}</span>
            </span>
          ))}
          <Info
            className="h-3 w-3 text-muted-foreground"
            aria-label="Hover any row's score for breakdown"
          />
        </div>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Reason pill
// -----------------------------------------------------------------------------

function ReasonPill({ chip }: { chip: ReasonChip }) {
  const Icon = ICON_FOR_KIND[chip.kind]
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-full border border-border bg-background px-2 text-[11px] text-foreground">
      <Icon className="h-3 w-3 text-muted-foreground" />
      <span className="truncate max-w-[220px]">{chip.label}</span>
    </span>
  )
}

const ICON_FOR_KIND: Record<ReasonChip['kind'], React.ComponentType<{ className?: string }>> = {
  sla: Clock,
  value: DollarSign,
  stale_contact: CalendarOff,
  treatment_gap: Activity,
  risk: AlertTriangle,
  momentum: TrendingDown,
}

// -----------------------------------------------------------------------------
// Snooze picker
// -----------------------------------------------------------------------------

function SnoozePicker({ onPick }: { onPick: (d: Date) => void }) {
  const [calendarOpen, setCalendarOpen] = useState(false)

  function tomorrow9am(): Date {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(9, 0, 0, 0)
    return d
  }
  function inDays(n: number): Date {
    const d = new Date()
    d.setDate(d.getDate() + n)
    d.setHours(9, 0, 0, 0)
    return d
  }
  function nextMonday(): Date {
    const d = new Date()
    const day = d.getDay() // 0 Sun - 6 Sat
    const diff = (8 - day) % 7 || 7 // always next Monday
    d.setDate(d.getDate() + diff)
    d.setHours(9, 0, 0, 0)
    return d
  }

  const options: { label: string; value: () => Date }[] = [
    { label: 'Tomorrow 9am', value: tomorrow9am },
    { label: 'In 3 days', value: () => inDays(3) },
    { label: 'Next Monday', value: nextMonday },
  ]

  if (calendarOpen) {
    return (
      <div className="flex flex-col gap-2">
        <div className="text-[12px] text-muted-foreground">Pick a date</div>
        <Calendar
          mode="single"
          onSelect={(d) => {
            if (d) {
              const out = new Date(d)
              out.setHours(9, 0, 0, 0)
              onPick(out)
            }
          }}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="px-1 pb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
        Snooze until
      </div>
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          onClick={() => onPick(o.value())}
          className="rounded-md px-2 py-1.5 text-left text-[13px] text-foreground hover:bg-accent"
        >
          {o.label}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setCalendarOpen(true)}
        className="rounded-md px-2 py-1.5 text-left text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        Custom date…
      </button>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Empty state
// -----------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card py-20 text-center">
      <div className="text-[13px] text-foreground">All quiet.</div>
      <div className="mt-1 text-[12px] text-muted-foreground">
        Try broadening your filters.
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function matchesFilter(c: RankedCase, f: FilterKey, now: number): boolean {
  if (f === 'today') {
    return (
      c.priorityTier === 'critical' ||
      c.priorityTier === 'high' ||
      c.priorityTier === 'medium'
    )
  }
  if (f === 'week') {
    return true // top 30 applied after filter
  }
  if (f === 'sla_risk') {
    if (!c.slaDeadline) return false
    const ms = new Date(c.slaDeadline).getTime() - now
    // sla_urgency score >= 60 means within 24h.
    return ms < MS_PER_DAY
  }
  if (f === 'high_value') {
    return (c.estValue ?? 0) >= 75_000
  }
  if (f === 'stale') {
    if (!c.lastContactAt) return true
    const age = now - new Date(c.lastContactAt).getTime()
    return age > 7 * MS_PER_DAY
  }
  return true
}

function slaMs(c: RankedCase): number {
  if (!c.slaDeadline) return Number.POSITIVE_INFINITY
  return new Date(c.slaDeadline).getTime()
}

function contactMs(c: RankedCase): number {
  if (!c.lastContactAt) return 0 // never contacted → surfaces first
  return new Date(c.lastContactAt).getTime()
}

function tierChipClass(tier: PriorityTier): string {
  switch (tier) {
    case 'critical':
      return 'bg-red-500/15 text-red-400 border border-red-500/20'
    case 'high':
      return 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
    case 'medium':
      return 'bg-muted text-foreground border border-border'
    case 'low':
      return 'bg-muted/50 text-muted-foreground border border-border'
  }
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1] ?? '') : ''
  const out = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
  return out || first.charAt(0).toUpperCase()
}

function todayLabel(filters: Set<FilterKey>): string {
  if (filters.has('today') && !filters.has('week')) return "Today's calls"
  if (filters.has('week')) return "This week's calls"
  return 'Call queue'
}
