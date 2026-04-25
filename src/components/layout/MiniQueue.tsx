import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Sparkles, ArrowRight } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/AuthContext'
import { getRankedQueue } from '@/lib/queueData'
import { resolveCaseTrack } from '@/lib/caseTrack'
import { TrackChip } from '@/components/case/TrackChip'

const MINI_LIMIT = 5

/**
 * Compact AI-ranked queue surfaced in the left nav. Shows the top
 * {@link MINI_LIMIT} cases with rank, name, AI score, and where the case is
 * heading. Clicking a row opens the full case; the footer link jumps to the
 * full queue page where the user can drag, snooze, and filter.
 *
 * Hidden when the sidebar collapses to icon-only.
 */
export function MiniQueue() {
  const { user } = useAuth()
  const location = useLocation()
  const userKey = user?.uid || 'default'
  const orderStorageKey = `caos:queue:${userKey}:order`
  const snoozeStorageKey = `caos:queue:${userKey}:snooze`

  // Re-read on route change so reorders/snoozes from the full page show up.
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    setRevision((r) => r + 1)
  }, [location.pathname])

  // Re-render on track-override changes from the full queue page.
  useEffect(() => {
    function bump() {
      setRevision((r) => r + 1)
    }
    window.addEventListener('caos:track-override', bump)
    return () => window.removeEventListener('caos:track-override', bump)
  }, [])

  const items = useMemo(() => {
    const ranked = getRankedQueue(new Date())
    const byId = new Map(ranked.map((c) => [c.id, c]))

    const customOrder = readJson<string[]>(orderStorageKey)
    const snooze = readJson<Record<string, string>>(snoozeStorageKey)
    const now = Date.now()

    let list = ranked
    if (customOrder && customOrder.length > 0) {
      list = customOrder
        .map((id) => byId.get(id))
        .filter((c): c is NonNullable<typeof c> => Boolean(c))
    }

    if (snooze) {
      list = list.filter((c) => {
        const until = snooze[c.id]
        if (!until) return true
        return new Date(until).getTime() <= now
      })
    }

    return list.slice(0, MINI_LIMIT)
    // revision is intentional dependency to force recompute on route change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderStorageKey, snoozeStorageKey, revision])

  if (items.length === 0) return null

  return (
    <div className="px-2 pb-2 group-data-[collapsible=icon]:hidden">
      <div className="mb-1 flex items-center justify-between px-2">
        <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          <Sparkles className="h-3 w-3 text-ring" />
          Live Queue
        </span>
        <Link
          to="/queue"
          className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground"
        >
          Open
          <ArrowRight className="h-2.5 w-2.5" />
        </Link>
      </div>

      <ul className="overflow-hidden rounded-md border border-sidebar-border bg-sidebar-accent/30">
        {items.map((c, i) => {
          const track = resolveCaseTrack(c, userKey)
          return (
            <li
              key={c.id}
              className={cn(
                'border-b border-sidebar-border last:border-0',
                'hover:bg-sidebar-accent/60',
              )}
            >
              <Link
                to={`/case-demo/${c.id}`}
                className="flex items-center gap-1.5 px-2 py-1.5 outline-none"
              >
                <span className="w-4 shrink-0 text-center font-mono text-[10px] text-muted-foreground">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-sidebar-foreground">
                  {c.clientName}
                </span>
                <TrackChip info={track} variant="compact" className="h-5 px-1.5 text-[10px]" />
                <span
                  className="ml-auto inline-flex h-5 items-center rounded font-mono text-[10px] text-muted-foreground"
                  title={`AI score: ${c.aiScore}/100`}
                >
                  {c.aiScore}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>

      <Link
        to="/queue/run?start=0"
        className="mt-1 flex items-center justify-center gap-1 rounded-md border border-sidebar-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
      >
        Start queue run
      </Link>
    </div>
  )
}

function readJson<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}
