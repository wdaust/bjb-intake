import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  Clock,
  Compass,
  User as UserIcon,
  Zap,
  Home,
  Inbox,
  Briefcase,
  BarChart3,
  PhoneCall,
  FileSignature,
  CalendarPlus,
  UserPlus,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type IconType = React.ComponentType<{ className?: string }>

interface CommandItem {
  id: string
  label: string
  hint?: string
  icon: IconType
  route?: string
  action?: () => void
  keywords?: string
}

interface CommandGroup {
  id: string
  label: string
  icon: IconType
  items: CommandItem[]
}

interface CommandBarProps {
  open: boolean
  onClose: () => void
}

// --- Demo / mock data -------------------------------------------------------
const DEMO_LEADS: CommandItem[] = [
  {
    id: 'INT-260424-maria',
    label: 'Maria Santos',
    hint: 'Lead \u00b7 MVA \u00b7 NJ',
    icon: UserIcon,
    route: '/intake/INT-260424-maria',
    keywords: 'maria santos mva nj',
  },
  {
    id: 'INT-260421-001',
    label: 'James Thompson',
    hint: 'Lead \u00b7 Slip and Fall \u00b7 NY',
    icon: UserIcon,
    route: '/intake/INT-260421-001',
    keywords: 'james thompson slip fall ny',
  },
  {
    id: 'INT-260420-002',
    label: 'Aisha Bell',
    hint: 'Lead \u00b7 Premises \u00b7 PA',
    icon: UserIcon,
    route: '/intake/INT-260420-002',
    keywords: 'aisha bell premises pa',
  },
  {
    id: 'INT-260419-003',
    label: 'Dante Rivera',
    hint: 'Lead \u00b7 MVA \u00b7 NY',
    icon: UserIcon,
    route: '/intake/INT-260419-003',
    keywords: 'dante rivera mva ny',
  },
  {
    id: 'INT-260418-004',
    label: 'Priya Shankar',
    hint: 'Lead \u00b7 Dog Bite \u00b7 NJ',
    icon: UserIcon,
    route: '/intake/INT-260418-004',
    keywords: 'priya shankar dog bite nj',
  },
]

const RECENT: CommandItem[] = [
  {
    id: 'recent-maria',
    label: 'Maria Santos',
    hint: 'Viewed 4m ago',
    icon: Clock,
    route: '/intake/INT-260424-maria',
    keywords: 'maria santos recent',
  },
  {
    id: 'recent-james',
    label: 'James Thompson',
    hint: 'Viewed 1h ago',
    icon: Clock,
    route: '/intake/INT-260421-001',
    keywords: 'james thompson recent',
  },
  {
    id: 'recent-aisha',
    label: 'Aisha Bell',
    hint: 'Viewed yesterday',
    icon: Clock,
    route: '/intake/INT-260420-002',
    keywords: 'aisha bell recent',
  },
]

const NAVIGATE: CommandItem[] = [
  { id: 'nav-today', label: 'Today', hint: 'Daily briefing', icon: Home, route: '/today', keywords: 'today home' },
  { id: 'nav-intake', label: 'Intake Queue', hint: 'New leads', icon: Inbox, route: '/intake', keywords: 'intake queue leads new' },
  { id: 'nav-caseload', label: 'Caseload', hint: 'All active cases', icon: Briefcase, route: '/', keywords: 'caseload cases' },
  { id: 'nav-manager', label: 'Manager view', hint: 'Team dashboard', icon: BarChart3, route: '/manager', keywords: 'manager dashboard team' },
]

function buildActions(navigate: (to: string) => void, close: () => void): CommandItem[] {
  return [
    {
      id: 'act-new-lead',
      label: 'Create new lead',
      hint: 'Start a fresh intake',
      icon: UserPlus,
      keywords: 'create new lead intake',
      action: () => {
        navigate('/intake')
        close()
      },
    },
    {
      id: 'act-start-call',
      label: 'Start call',
      hint: 'Guided intake call',
      icon: PhoneCall,
      keywords: 'start call phone dial',
      action: close,
    },
    {
      id: 'act-send-agreement',
      label: 'Send agreement',
      hint: 'E-sign retainer',
      icon: FileSignature,
      keywords: 'send agreement retainer sign',
      action: close,
    },
    {
      id: 'act-schedule',
      label: 'Schedule appointment',
      hint: 'Book on calendar',
      icon: CalendarPlus,
      keywords: 'schedule appointment calendar book',
      action: close,
    },
  ]
}

// ---------------------------------------------------------------------------

export function CommandBar({ open, onClose }: CommandBarProps) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Groups and filtered flat list ------------------------------------------
  const groups: CommandGroup[] = useMemo(() => {
    const actions = buildActions(navigate, onClose)
    return [
      { id: 'recent', label: 'Recent', icon: Clock, items: RECENT },
      { id: 'navigate', label: 'Navigate', icon: Compass, items: NAVIGATE },
      { id: 'leads', label: 'Leads', icon: UserIcon, items: DEMO_LEADS },
      { id: 'actions', label: 'Actions', icon: Zap, items: actions },
    ]
  }, [navigate, onClose])

  const filtered: CommandGroup[] = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return groups
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter((it) => {
          const hay = `${it.label} ${it.hint ?? ''} ${it.keywords ?? ''}`.toLowerCase()
          return hay.includes(q)
        }),
      }))
      .filter((g) => g.items.length > 0)
  }, [groups, query])

  const flat: CommandItem[] = useMemo(() => filtered.flatMap((g) => g.items), [filtered])

  // Reset state on open ----------------------------------------------------
  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      // Focus input after render tick so the dialog has mounted
      const t = window.setTimeout(() => inputRef.current?.focus(), 10)
      return () => window.clearTimeout(t)
    }
    return undefined
  }, [open])

  // Clamp active index when filtered changes -------------------------------
  useEffect(() => {
    if (active >= flat.length) setActive(0)
  }, [flat.length, active])

  // Body scroll lock -------------------------------------------------------
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  // Keyboard handling ------------------------------------------------------
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActive((i) => (flat.length === 0 ? 0 : (i + 1) % flat.length))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActive((i) => (flat.length === 0 ? 0 : (i - 1 + flat.length) % flat.length))
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const item = flat[active]
        if (item) runItem(item)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, flat, active])

  // Scroll active into view ------------------------------------------------
  useEffect(() => {
    if (!open) return
    const el = listRef.current?.querySelector<HTMLElement>(`[data-cmd-index="${active}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  function runItem(item: CommandItem) {
    if (item.action) {
      item.action()
      return
    }
    if (item.route) {
      navigate(item.route)
      onClose()
    }
  }

  if (!open) return null

  // Running counter for flat index across groups ---------------------------
  let flatIndex = -1

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command bar"
      className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[12vh]"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="relative w-full max-w-[640px] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground"
        style={{ maxHeight: '40vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Input */}
        <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to case, search leads, run command..."
            className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none"
            spellCheck={false}
            autoComplete="off"
          />
          <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-border bg-background px-1.5 font-mono text-[10px] text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="flex-1 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-8 text-center text-[13px] text-muted-foreground">
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            filtered.map((group) => {
              const GroupIcon = group.icon
              return (
                <div key={group.id} className="py-1">
                  <div className="flex items-center gap-1.5 px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    <GroupIcon className="h-3 w-3" aria-hidden="true" />
                    {group.label}
                  </div>
                  <ul>
                    {group.items.map((item) => {
                      flatIndex += 1
                      const idx = flatIndex
                      const isActive = idx === active
                      const ItemIcon = item.icon
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            data-cmd-index={idx}
                            onMouseEnter={() => setActive(idx)}
                            onClick={() => runItem(item)}
                            className={cn(
                              'flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] transition-colors',
                              isActive
                                ? 'bg-accent text-foreground'
                                : 'text-foreground/90 hover:bg-accent/60'
                            )}
                          >
                            <ItemIcon
                              className={cn(
                                'h-4 w-4 shrink-0',
                                isActive ? 'text-primary' : 'text-muted-foreground'
                              )}
                              aria-hidden="true"
                            />
                            <span className="flex-1 truncate">{item.label}</span>
                            {item.hint && (
                              <span
                                className={cn(
                                  'ml-2 truncate text-[11px]',
                                  item.id.startsWith('INT-') || item.id.startsWith('recent-')
                                    ? 'font-mono'
                                    : '',
                                  'text-muted-foreground'
                                )}
                              >
                                {item.hint}
                              </span>
                            )}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border bg-background/40 px-3 py-1.5 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <kbd className="inline-flex h-4 items-center rounded border border-border bg-background px-1 font-mono text-[10px]">
                &uarr;
              </kbd>
              <kbd className="inline-flex h-4 items-center rounded border border-border bg-background px-1 font-mono text-[10px]">
                &darr;
              </kbd>
              navigate
            </span>
            <span className="inline-flex items-center gap-1">
              <kbd className="inline-flex h-4 items-center rounded border border-border bg-background px-1 font-mono text-[10px]">
                &crarr;
              </kbd>
              select
            </span>
          </div>
          <span className="font-mono">CAOS</span>
        </div>
      </div>
    </div>
  )
}
