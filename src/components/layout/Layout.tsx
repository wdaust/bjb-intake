import { Link, Outlet, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'

const navItems = [
  { label: 'Caseload', path: '/' },
  { label: 'Manager Dashboard', path: '/manager' },
]

export function Layout() {
  const location = useLocation()
  const isCallScreen = location.pathname.startsWith('/call/')

  return (
    <div className="min-h-screen bg-background">
      {!isCallScreen && (
        <header className="border-b bg-card sticky top-0 z-50">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
            <Link to="/" className="text-lg font-semibold tracking-tight">
              Case Advancement OS
            </Link>
            <nav className="flex gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    location.pathname === item.path
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
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
