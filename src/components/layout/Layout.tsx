import { useEffect, useMemo, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Home,
  Inbox,
  Briefcase,
  BarChart3,
  Workflow,
  LogOut,
  Command as CommandIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/AuthContext'
import { useQueue } from '@/lib/QueueContext'
import { CommandBar } from './CommandBar'

type IconType = React.ComponentType<{ className?: string }>

interface NavItem {
  label: string
  path: string
  icon: IconType
  badge?: number
  /** match nested routes that should keep the item active */
  matchPrefixes?: string[]
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Today', path: '/today', icon: Home, matchPrefixes: ['/today'] },
  { label: 'Intake', path: '/intake', icon: Inbox, badge: 3, matchPrefixes: ['/intake'] },
  { label: 'Caseload', path: '/', icon: Briefcase, matchPrefixes: ['/case/', '/call/', '/timeline/', '/summary/'] },
  { label: 'Manager', path: '/manager', icon: BarChart3, matchPrefixes: ['/manager'] },
  { label: 'Flow Builder', path: '/builder', icon: Workflow, matchPrefixes: ['/builder'] },
]

// Pretty labels for common path segments when building breadcrumbs.
const CRUMB_LABELS: Record<string, string> = {
  '': 'Caseload',
  today: 'Today',
  intake: 'Intake',
  case: 'Case',
  call: 'Call',
  timeline: 'Timeline',
  summary: 'Summary',
  manager: 'Manager',
  test: 'Demo Mode',
  builder: 'Flow Builder',
}

function prettifySegment(seg: string): string {
  if (CRUMB_LABELS[seg]) return CRUMB_LABELS[seg]
  // Preserve id-like segments (e.g. INT-260424-maria, 0Pp00...) as monospace-ready.
  return seg
}

function buildBreadcrumbs(pathname: string): Array<{ label: string; href?: string; mono?: boolean }> {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) {
    return [{ label: 'Caseload' }]
  }
  const crumbs: Array<{ label: string; href?: string; mono?: boolean }> = []
  let acc = ''
  segments.forEach((seg, i) => {
    acc += `/${seg}`
    const isLast = i === segments.length - 1
    const mapped = CRUMB_LABELS[seg]
    const looksLikeId = !mapped && /[0-9A-Z\-_]/.test(seg) && (seg.length > 8 || /^[A-Z]{2,}-/.test(seg))
    crumbs.push({
      label: mapped ?? prettifySegment(seg),
      href: isLast ? undefined : acc,
      mono: !mapped && looksLikeId,
    })
  })
  return crumbs
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1] ?? '') : ''
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || first.charAt(0).toUpperCase()
}

function isNavActive(item: NavItem, pathname: string): boolean {
  if (item.path === '/') {
    // Caseload is the root; only exact match (nested case/ routes handled via matchPrefixes).
    if (pathname === '/') return true
  } else if (pathname === item.path) {
    return true
  }
  if (item.matchPrefixes) {
    return item.matchPrefixes.some((p) => {
      if (p === '/') return pathname === '/'
      return pathname === p || pathname.startsWith(p.endsWith('/') ? p : `${p}/`)
    })
  }
  return false
}

export function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { cmName } = useQueue()

  const [commandOpen, setCommandOpen] = useState(false)
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth < 1280
  })

  // Full-bleed screens (e.g. guided call) render without the shell chrome.
  const isCallScreen = location.pathname.startsWith('/call/')

  // Auto-collapse sidebar on narrow viewports.
  useEffect(() => {
    function onResize() {
      setCollapsed(window.innerWidth < 1280)
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Global Cmd+K / Ctrl+K listener.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCommandOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const breadcrumbs = useMemo(() => buildBreadcrumbs(location.pathname), [location.pathname])

  const displayName = cmName || user?.displayName || user?.email?.split('@')[0] || 'User'
  const roleLabel = 'Case Manager'

  async function handleLogout() {
    try {
      await logout()
    } finally {
      navigate('/login', { replace: true })
    }
  }

  if (isCallScreen) {
    // Minimal chrome: just render the call view full-bleed.
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Outlet />
        <CommandBar open={commandOpen} onClose={() => setCommandOpen(false)} />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* -------- Sidebar -------- */}
      <aside
        className={cn(
          'flex shrink-0 flex-col border-r border-border bg-card transition-[width] duration-150',
          collapsed ? 'w-[56px]' : 'w-[240px]'
        )}
        aria-label="Primary"
      >
        {/* Brand */}
        <div
          className={cn(
            'flex h-12 items-center border-b border-border',
            collapsed ? 'justify-center px-0' : 'px-4'
          )}
        >
          <Link
            to="/"
            className="flex items-center gap-2 text-primary"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
            aria-label="BJB home"
          >
            <span className="text-[18px] font-semibold leading-none tracking-tight">BJB</span>
            {!collapsed && (
              <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
                CAOS
              </span>
            )}
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2">
          <ul className="flex flex-col gap-0.5 px-2">
            {NAV_ITEMS.map((item) => {
              const active = isNavActive(item, location.pathname)
              const Icon = item.icon
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'group relative flex items-center rounded-md text-[13px] font-medium transition-colors',
                      collapsed ? 'h-8 w-10 justify-center' : 'h-8 gap-2 px-2.5',
                      active
                        ? 'border-l-2 border-primary bg-primary/10 text-foreground'
                        : 'border-l-2 border-transparent text-muted-foreground hover:bg-accent/40 hover:text-foreground'
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-4 w-4 shrink-0',
                        active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                      )}
                    />
                    {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                    {!collapsed && typeof item.badge === 'number' && item.badge > 0 && (
                      <span className="ml-auto inline-flex h-4 min-w-4 items-center justify-center rounded-sm bg-muted px-1 font-mono text-[10px] text-foreground/90">
                        {item.badge}
                      </span>
                    )}
                    {collapsed && typeof item.badge === 'number' && item.badge > 0 && (
                      <span
                        className="absolute -right-0.5 -top-0.5 inline-flex h-3 min-w-3 items-center justify-center rounded-full bg-primary px-1 font-mono text-[9px] text-primary-foreground"
                        aria-label={`${item.badge} new`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* User footer */}
        <div className="border-t border-border p-2">
          <div
            className={cn(
              'flex items-center rounded-md',
              collapsed ? 'justify-center' : 'gap-2 px-1.5 py-1.5'
            )}
          >
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground"
              aria-hidden="true"
            >
              {initials(displayName)}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-medium text-foreground">{displayName}</div>
                <div className="truncate text-[11px] text-muted-foreground">{roleLabel}</div>
              </div>
            )}
            {!collapsed && (
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
          {collapsed && (
            <button
              type="button"
              onClick={handleLogout}
              className="mt-1 flex h-7 w-full items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </aside>

      {/* -------- Main column -------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-background px-4">
          {/* Breadcrumbs */}
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[12px]">
            {breadcrumbs.map((c, i) => {
              const isLast = i === breadcrumbs.length - 1
              return (
                <span key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1.5">
                  {i > 0 && <span className="text-muted-foreground/50">/</span>}
                  {c.href && !isLast ? (
                    <Link
                      to={c.href}
                      className={cn(
                        'truncate text-muted-foreground hover:text-foreground',
                        c.mono && 'font-mono'
                      )}
                    >
                      {c.label}
                    </Link>
                  ) : (
                    <span
                      className={cn(
                        'truncate',
                        isLast ? 'text-foreground' : 'text-muted-foreground',
                        c.mono && 'font-mono'
                      )}
                    >
                      {c.label}
                    </span>
                  )}
                </span>
              )
            })}
          </nav>

          {/* Cmd+K hint */}
          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-card px-2 text-[12px] text-muted-foreground transition-colors hover:border-muted-foreground/40 hover:text-foreground"
            aria-label="Open command bar"
          >
            <CommandIcon className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Search or jump to...</span>
            <kbd className="inline-flex h-4 items-center rounded border border-border bg-background px-1 font-mono text-[10px] text-muted-foreground">
              {typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac')
                ? '\u2318'
                : 'Ctrl'}
              K
            </kbd>
          </button>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* Command palette */}
      <CommandBar open={commandOpen} onClose={() => setCommandOpen(false)} />
    </div>
  )
}
