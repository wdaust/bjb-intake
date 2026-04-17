import { Link, Outlet, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/AuthContext'
import { useQueue } from '@/lib/QueueContext'

const navItems = [
  { label: 'Caseload', path: '/' },
  { label: 'Dashboard', path: '/manager' },
  { label: 'Demo Mode', path: '/test' },
  { label: 'Flow Builder', path: '/builder' },
]

export function Layout() {
  const location = useLocation()
  const { user, logout } = useAuth()
  const { cmName } = useQueue()
  const isCallScreen = location.pathname.startsWith('/call/')

  return (
    <div className="min-h-screen bg-background">
      {!isCallScreen && (
        <header className="border-b border-border/50 glass sticky top-0 z-50 relative">
          <div className="mx-auto flex h-12 max-w-7xl items-center justify-between px-4">
            <Link to="/" className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center">
                <span className="text-xs font-bold text-primary-foreground">CA</span>
              </div>
              <span className="text-sm font-semibold tracking-tight">Case Advancement OS</span>
            </Link>
            <div className="flex items-center gap-1">
              <nav className="flex gap-0.5">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                      location.pathname === item.path
                        ? 'bg-primary/15 text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
              {user && (
                <div className="flex items-center gap-2 text-xs border-l border-border/50 ml-2 pl-3">
                  <span className="text-muted-foreground">{cmName || user.displayName || user.email}</span>
                  <button
                    onClick={() => logout()}
                    className="text-[10px] text-muted-foreground/70 hover:text-foreground transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="gradient-line h-[2px] w-full absolute bottom-0 left-0" />
        </header>
      )}
      <main className={cn(
        'mx-auto px-4 py-6',
        isCallScreen ? 'max-w-full' : 'max-w-7xl'
      )}>
        <Outlet />
      </main>
    </div>
  )
}
