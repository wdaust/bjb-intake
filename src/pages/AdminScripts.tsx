import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getScripts, getQuestionCount } from '@/db/queries'

interface ScriptDisplay {
  id: string
  name: string
  description: string | null
  questionCount: number
  updatedAt: Date
}

export function AdminScripts() {
  const [scriptList, setScriptList] = useState<ScriptDisplay[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const rows = await getScripts()
      const display = await Promise.all(
        rows.map(async (s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          questionCount: await getQuestionCount(s.id),
          updatedAt: s.updatedAt,
        }))
      )
      setScriptList(display)
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manage Scripts</h1>
          <p className="text-muted-foreground">
            Create and edit intake scripts with guided questions.
          </p>
        </div>
        <Button disabled>New Script</Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading scripts...</p>
      ) : (
        scriptList.map((s) => (
          <Card key={s.id}>
            <CardHeader>
              <CardTitle>{s.name}</CardTitle>
              <CardDescription>
                {s.questionCount} question{s.questionCount !== 1 ? 's' : ''} — Last updated {new Date(s.updatedAt).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            {s.description && (
              <CardContent>
                <p className="text-sm text-muted-foreground">{s.description}</p>
              </CardContent>
            )}
          </Card>
        ))
      )}
    </div>
  )
}
