import { useMemo, useState } from 'react'
import { CalendarCheck, Bell, Check } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { initials } from '@/lib/intakeUtils'

// Pick a CM + date + time and book an intro call. Shows the reminder-
// cascade preview up front so the IS knows what's coming.

export interface CmOption {
  id: string
  name: string
  availableSlots: string[] // ISO datetimes
}

export interface BookingPayload {
  cmUserId: string
  cmName: string
  scheduledTs: string
}

export interface BookedState {
  cmUserId: string
  cmName: string
  scheduledTs: string
}

interface AppointmentSchedulerProps {
  cmOptions: CmOption[]
  onBook?: (payload: BookingPayload) => void
  booked?: BookedState | null
  className?: string
}

const REMINDER_COPY =
  'Reminders will fire at 24h · 2h · 30m · 10m · 5m · 1m via SMS + email'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatDateTime(iso: string): string {
  return `${formatDate(iso)}, ${formatTime(iso)}`
}

export function AppointmentScheduler({
  cmOptions,
  onBook,
  booked,
  className,
}: AppointmentSchedulerProps) {
  const firstCm = cmOptions[0]
  const [cmId, setCmId] = useState<string>(firstCm?.id ?? '')
  const currentCm = cmOptions.find((c) => c.id === cmId) ?? firstCm

  // Group slots by date (ISO yyyy-mm-dd).
  const slotsByDate = useMemo(() => {
    const map: Record<string, string[]> = {}
    const slots = currentCm?.availableSlots ?? []
    for (const slot of slots) {
      const day = slot.slice(0, 10)
      const existing = map[day]
      if (existing) existing.push(slot)
      else map[day] = [slot]
    }
    return map
  }, [currentCm])

  const dateKeys = useMemo(() => Object.keys(slotsByDate).sort(), [slotsByDate])
  const [dateKey, setDateKey] = useState<string>(dateKeys[0] ?? '')
  const availableTimes = slotsByDate[dateKey] ?? []
  const [timeIso, setTimeIso] = useState<string>(availableTimes[0] ?? '')

  const canBook = Boolean(currentCm && dateKey && timeIso)

  function handleBook() {
    if (!canBook || !currentCm) return
    onBook?.({
      cmUserId: currentCm.id,
      cmName: currentCm.name,
      scheduledTs: timeIso,
    })
  }

  if (booked) {
    return (
      <div
        className={cn(
          'rounded-lg border border-border bg-card p-4',
          className,
        )}
      >
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Intro call
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-[11px] font-semibold text-foreground">
            {initials(booked.cmName)}
          </div>
          <div className="flex-1">
            <div className="text-[13px] font-semibold text-foreground">
              {booked.cmName}
            </div>
            <div className="font-mono text-[12px] text-muted-foreground">
              {formatDateTime(booked.scheduledTs)}
            </div>
          </div>
          <span className="inline-flex h-5 items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 text-[11px] font-medium text-emerald-300">
            <Check className="mr-1 h-3 w-3" />
            Confirmed
          </span>
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-md border border-border bg-ring/10 p-2.5">
          <Bell className="mt-[2px] h-3 w-3 shrink-0 text-ring" />
          <div className="text-[11px] leading-[1.5] text-muted-foreground">
            {REMINDER_COPY}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-4',
        className,
      )}
    >
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Schedule intro call
      </div>

      <div className="mt-3 grid grid-cols-[1fr_1fr_1fr] gap-2">
        <SchedulerSelect
          label="Case manager"
          value={cmId}
          onChange={(v) => {
            setCmId(v)
            const next = cmOptions.find((c) => c.id === v)
            const firstDay = next?.availableSlots[0]?.slice(0, 10) ?? ''
            setDateKey(firstDay)
            const firstSlot = next?.availableSlots.find(
              (s) => s.slice(0, 10) === firstDay,
            )
            setTimeIso(firstSlot ?? '')
          }}
          options={cmOptions.map((c) => ({ value: c.id, label: c.name }))}
        />
        <SchedulerSelect
          label="Date"
          value={dateKey}
          onChange={(v) => {
            setDateKey(v)
            const firstSlot = slotsByDate[v]?.[0] ?? ''
            setTimeIso(firstSlot)
          }}
          options={dateKeys.map((d) => ({
            value: d,
            label: formatDate(`${d}T00:00:00`),
          }))}
        />
        <SchedulerSelect
          label="Time"
          value={timeIso}
          onChange={setTimeIso}
          options={availableTimes.map((t) => ({
            value: t,
            label: formatTime(t),
          }))}
        />
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-md border border-border bg-ring/10 p-2.5">
        <Bell className="mt-[2px] h-3 w-3 shrink-0 text-ring" />
        <div className="text-[11px] leading-[1.5] text-muted-foreground">
          {REMINDER_COPY}
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <Button
          size="sm"
          className="h-7 rounded-md bg-ring text-[12px] text-background hover:bg-ring/90"
          onClick={handleBook}
          disabled={!canBook}
        >
          <CalendarCheck className="mr-1 h-3 w-3" />
          Confirm booking
        </Button>
      </div>
    </div>
  )
}

function SchedulerSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <Select value={value} onValueChange={(v) => v && onChange(v)}>
        <SelectTrigger className="h-8 w-full border-border bg-card px-2 text-[12px] text-foreground">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="border-border bg-card text-[13px] text-foreground">
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  )
}

export default AppointmentScheduler
