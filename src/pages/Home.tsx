import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'

export function Home() {
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Case Intake</h1>
        <p className="text-muted-foreground">
          Select a script to begin gathering information for a new case.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Placeholder - will be populated from DB */}
        <Card className="cursor-pointer transition-shadow hover:shadow-md">
          <CardHeader>
            <CardTitle>PI Auto Accident</CardTitle>
            <CardDescription>12 questions</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              onClick={() => navigate('/intake/demo')}
            >
              Start Intake
            </Button>
          </CardContent>
        </Card>

        <Card className="border-dashed opacity-60">
          <CardHeader>
            <CardTitle className="text-muted-foreground">
              More scripts coming soon
            </CardTitle>
            <CardDescription>
              Create scripts in the admin panel
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  )
}
