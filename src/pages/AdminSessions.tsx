import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getSessions, getSessionResponses, getScriptWithQuestions } from '@/db/queries'
import { useNavigate } from 'react-router-dom'

interface SessionDisplay {
  id: string
  scriptName: string
  callerName: string | null
  status: string
  createdAt: Date
  answeredCount: number
  totalQuestions: number
}

export function AdminSessions() {
  const [sessionList, setSessionList] = useState<SessionDisplay[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      const rows = await getSessions()
      const display = await Promise.all(
        rows.map(async (s) => {
          const { script, questions } = await getScriptWithQuestions(s.scriptId)
          const responses = await getSessionResponses(s.id)
          return {
            id: s.id,
            scriptName: script.name,
            callerName: s.callerName,
            status: s.status,
            createdAt: s.createdAt,
            answeredCount: responses.filter(r => r.value?.trim()).length,
            totalQuestions: questions.length,
          }
        })
      )
      setSessionList(display)
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Intake Sessions</h1>
        <p className="text-muted-foreground">
          View completed and in-progress intake sessions.
        </p>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading sessions...</p>
      ) : sessionList.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-muted-foreground">No sessions yet</CardTitle>
            <CardDescription>Start an intake from the home page</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        sessionList.map((s) => (
          <Card key={s.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">
                    {s.callerName || `Session ${s.id.slice(0, 8)}...`}
                  </CardTitle>
                  <CardDescription>
                    {s.scriptName} — {new Date(s.createdAt).toLocaleDateString()}
                  </CardDescription>
                </div>
                <Badge variant={s.status === 'completed' ? 'default' : 'secondary'}>
                  {s.status === 'completed' ? 'Completed' : 'In Progress'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {s.answeredCount} of {s.totalQuestions} questions answered
              </p>
              {s.status === 'in_progress' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/intake/${s.id}`)}
                >
                  Resume
                </Button>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
