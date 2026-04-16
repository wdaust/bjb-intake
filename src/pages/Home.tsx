import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'
import { getScripts, getQuestionCount, createSession } from '@/db/queries'

interface ScriptWithCount {
  id: string
  name: string
  description: string | null
  questionCount: number
}

export function Home() {
  const navigate = useNavigate()
  const [scriptList, setScriptList] = useState<ScriptWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const rows = await getScripts()
      const withCounts = await Promise.all(
        rows.map(async (s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          questionCount: await getQuestionCount(s.id),
        }))
      )
      setScriptList(withCounts)
      setLoading(false)
    }
    load()
  }, [])

  async function handleStart(scriptId: string) {
    setStarting(scriptId)
    const session = await createSession(scriptId)
    navigate(`/intake/${session.id}`)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Case Intake</h1>
        <p className="text-muted-foreground">
          Select a script to begin gathering information for a new case.
        </p>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading scripts...</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {scriptList.map((s) => (
            <Card key={s.id} className="transition-shadow hover:shadow-md">
              <CardHeader>
                <CardTitle>{s.name}</CardTitle>
                <CardDescription>
                  {s.questionCount} question{s.questionCount !== 1 ? 's' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {s.description && (
                  <p className="text-sm text-muted-foreground">{s.description}</p>
                )}
                <Button
                  className="w-full"
                  disabled={starting === s.id}
                  onClick={() => handleStart(s.id)}
                >
                  {starting === s.id ? 'Starting...' : 'Start Intake'}
                </Button>
              </CardContent>
            </Card>
          ))}

          {scriptList.length === 0 && (
            <Card className="border-dashed opacity-60">
              <CardHeader>
                <CardTitle className="text-muted-foreground">
                  No scripts yet
                </CardTitle>
                <CardDescription>
                  Create scripts in the admin panel
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
