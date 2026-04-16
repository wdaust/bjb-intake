import { useParams } from 'react-router-dom'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export function Intake() {
  const { sessionId } = useParams()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">PI Auto Accident</h1>
          <p className="text-sm text-muted-foreground">Session: {sessionId}</p>
        </div>
        <Badge variant="secondary">Question 1 of 12</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What is the caller's full legal name?</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Confirm spelling. Ask for any aliases or maiden names.
          </p>
          {/* Input will go here based on question type */}
          <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
            Question input area — will render based on question type (text, select, date, etc.)
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" disabled>
            Previous
          </Button>
          <Button>
            Next Question
          </Button>
        </CardFooter>
      </Card>

      <div className="flex gap-1.5">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full ${
              i === 0 ? 'bg-primary' : 'bg-muted'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
