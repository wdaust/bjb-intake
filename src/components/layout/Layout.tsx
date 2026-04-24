import { useEffect, useMemo, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Home,
  Inbox,
  Briefcase,
  BarChart3,
  Workflow,
  ChevronRight,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/AuthContext'
import { useQueue } from '@/lib/QueueContext'
import { CommandBar } from './CommandBar'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '@/components/ui/sidebar'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// -----------------------------------------------------------------------------
// Route -> label mapping (single source of truth for nav + breadcrumbs)
// -----------------------------------------------------------------------------

type IconType = React.ComponentType<{ className?: string }>

interface NavItem {
  label: string
  path: string
  icon: IconType
  badge?: number
  /** nested routes that should keep the item active */
  matchPrefixes?: string[]
}

const NAV_ITEMS: NavItem[] = [
  // Today is the root route ("/"), so it matches both "/" and "/today".
  { label: 'Today', path: '/today', icon: Home, matchPrefixes: ['/today'] },
  { label: 'Intake', path: '/intake', icon: Inbox, badge: 3, matchPrefixes: ['/intake'] },
  {
    label: 'Caseload',
    path: '/caseload',
    icon: Briefcase,
    matchPrefixes: ['/caseload', '/case/', '/call/', '/timeline/', '/summary/', '/case-demo/'],
  },
  { label: 'Manager', path: '/manager', icon: BarChart3, matchPrefixes: ['/manager'] },
  { label: 'Flow Builder', path: '/builder', icon: Workflow, matchPrefixes: ['/builder'] },
]

/** Pretty labels for common path segments. */
const SEGMENT_LABELS: Record<string, string> = {
  today: 'Today',
  intake: 'Intake',
  case: 'Case',
  call: 'Call',
  timeline: 'Timeline',
  summary: 'Summary',
  manager: 'Manager',
  builder: 'Flow Builder',
  test: 'Demo Mode',
}

/** Root slug when the URL is "/". */
const ROOT_LABEL = 'Today'

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

interface Crumb {
  label: string
  href?: string
  mono?: boolean
}

function buildBreadcrumbs(pathname: string): Crumb[] {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return [{ label: ROOT_LABEL }]

  const crumbs: Crumb[] = []
  let acc = ''
  segments.forEach((seg, i) => {
    acc += `/${seg}`
    const isLast = i === segments.length - 1
    const mapped = SEGMENT_LABELS[seg]
    const looksLikeId =
      !mapped && /[0-9A-Z\-_]/.test(seg) && (seg.length > 8 || /^[A-Z]{2,}-/.test(seg))
    crumbs.push({
      label: mapped ?? seg,
      href: isLast ? undefined : acc,
      mono: !mapped && looksLikeId,
    })
  })
  return crumbs
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1] ?? '') : ''
  const out = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
  return out || first.charAt(0).toUpperCase()
}

function isNavActive(item: NavItem, pathname: string): boolean {
  // Today is the root route: active on "/" or "/today".
  if (item.path === '/today' && pathname === '/') return true
  if (item.path === '/') {
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

/** Collapse sidebar below this viewport width. */
const COLLAPSE_BREAKPOINT_PX = 1280

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches)
    setMatches(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}

// -----------------------------------------------------------------------------
// Layout
// -----------------------------------------------------------------------------

export function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { cmName } = useQueue()

  const [commandOpen, setCommandOpen] = useState(false)
  const isNarrow = useMediaQuery(`(max-width: ${COLLAPSE_BREAKPOINT_PX - 1}px)`)
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(!isNarrow)

  // When crossing the breakpoint, sync open state to the viewport.
  useEffect(() => {
    setSidebarOpen(!isNarrow)
  }, [isNarrow])

  // Full-bleed screens (e.g. guided call) render without the shell chrome.
  const isCallScreen = location.pathname.startsWith('/call/')

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
  const avatarInitials = initialsFromName(displayName)

  async function handleLogout() {
    try {
      await logout()
    } finally {
      navigate('/login', { replace: true })
    }
  }

  if (isCallScreen) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Outlet />
        <CommandBar open={commandOpen} onClose={() => setCommandOpen(false)} />
      </div>
    )
  }

  const isMac =
    typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac')

  return (
    <SidebarProvider
      open={sidebarOpen}
      onOpenChange={setSidebarOpen}
      style={
        {
          // sidebar-07 style: a tighter 220px rail matching webapp-ui skill rules.
          '--sidebar-width': '220px',
          '--sidebar-width-icon': '3rem',
        } as React.CSSProperties
      }
    >
      <Sidebar collapsible="icon" className="border-r border-sidebar-border">
        {/* Wordmark */}
        <SidebarHeader className="px-3 pt-3 pb-2">
          <Link
            to="/"
            className="flex flex-col gap-0.5 leading-none outline-none group-data-[collapsible=icon]:items-center"
            aria-label="CAOS home"
          >
            <span className="text-[15px] font-semibold tracking-tight text-sidebar-foreground">
              CAOS
            </span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground group-data-[collapsible=icon]:hidden">
              BJB
            </span>
          </Link>
        </SidebarHeader>

        {/* Nav */}
        <SidebarContent>
          <SidebarGroup className="px-2 py-1">
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const active = isNavActive(item, location.pathname)
                const Icon = item.icon
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={item.label}
                      className={cn(
                        'h-auto gap-2 rounded-md px-3 py-1.5 text-[13px] font-normal',
                        // Left accent border on active; transparent otherwise so height stays stable.
                        'border-l-2 border-transparent',
                        active &&
                          'border-ring bg-sidebar-accent text-sidebar-accent-foreground',
                        !active && 'hover:bg-sidebar-accent/50'
                      )}
                      render={<Link to={item.path} />}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {typeof item.badge === 'number' && item.badge > 0 && (
                        <SidebarMenuBadge
                          className={cn(
                            'static ml-auto h-4 min-w-4 rounded bg-muted px-1 font-mono text-[10px] text-muted-foreground',
                            'group-data-[collapsible=icon]:hidden'
                          )}
                        >
                          {item.badge}
                        </SidebarMenuBadge>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>

        {/* User */}
        <SidebarFooter className="border-t border-sidebar-border p-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left outline-none transition-colors hover:bg-sidebar-accent/60 focus-visible:bg-sidebar-accent/60"
                  aria-label="User menu"
                />
              }
            >
              <Avatar className="h-7 w-7 rounded-md">
                <AvatarFallback className="rounded-md bg-muted text-[11px] font-medium text-foreground">
                  {avatarInitials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                <div className="truncate text-[12px] font-medium text-sidebar-foreground">
                  {displayName.length > 24 ? displayName : shortName(displayName)}
                </div>
                <div className="truncate text-[11px] text-muted-foreground">{roleLabel}</div>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-[200px]">
              <DropdownMenuLabel className="text-[11px] text-muted-foreground">
                {user?.email ?? displayName}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-3.5 w-3.5" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-w-0 overflow-x-hidden">
        {/* Top bar */}
        <header
          className={cn(
            'sticky top-0 z-30 flex h-12 w-full min-w-0 shrink-0 items-center gap-3 border-b border-border',
            'bg-background/95 backdrop-blur-sm px-4'
          )}
        >
          <Breadcrumb className="min-w-0">
            <BreadcrumbList className="text-[12px]">
              {breadcrumbs.map((c, i) => {
                const isLast = i === breadcrumbs.length - 1
                const key = `${c.label}-${i}`
                return (
                  <span key={key} className="inline-flex items-center gap-1.5">
                    {i > 0 && (
                      <BreadcrumbSeparator className="text-muted-foreground/60">
                        <ChevronRight className="h-3 w-3" />
                      </BreadcrumbSeparator>
                    )}
                    <BreadcrumbItem>
                      {isLast || !c.href ? (
                        <BreadcrumbPage
                          className={cn(
                            'truncate text-foreground',
                            c.mono && 'font-mono text-[11px]'
                          )}
                        >
                          {c.label}
                        </BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink
                          className={cn(
                            'truncate text-muted-foreground hover:text-foreground',
                            c.mono && 'font-mono text-[11px]'
                          )}
                          render={<Link to={c.href} />}
                        >
                          {c.label}
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </span>
                )
              })}
            </BreadcrumbList>
          </Breadcrumb>

          {/* Search */}
          <div className="ml-auto flex items-center">
            <div className="relative">
              <Input
                type="text"
                readOnly
                placeholder="Search or jump to..."
                onFocus={(e) => {
                  e.currentTarget.blur()
                  setCommandOpen(true)
                }}
                onClick={() => setCommandOpen(true)}
                className="h-8 w-[260px] cursor-pointer bg-card pr-14 text-[12px]"
                aria-label="Open command palette"
              />
              <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border border-border px-1.5 font-mono text-[11px] text-muted-foreground">
                {isMac ? '\u2318' : 'Ctrl'}K
              </span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
          <Outlet />
        </main>
      </SidebarInset>

      <CommandBar open={commandOpen} onClose={() => setCommandOpen(false)} />
    </SidebarProvider>
  )
}

/** Squeeze long names to "First L." for the sidebar footer. */
function shortName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length < 2) return name
  const first = parts[0] ?? ''
  const last = parts[parts.length - 1] ?? ''
  return `${first} ${last.charAt(0)}.`
}
