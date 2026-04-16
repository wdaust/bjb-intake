import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function AdminSessions() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Intake Sessions</h1>
        <p className="text-muted-foreground">
          View completed and in-progress intake sessions.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Session #demo</CardTitle>
              <CardDescription>
                PI Auto Accident — Started Apr 16, 2026
              </CardDescription>
            </div>
            <Badge>In Progress</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            3 of 12 questions answered
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
