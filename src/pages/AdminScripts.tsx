import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function AdminScripts() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manage Scripts</h1>
          <p className="text-muted-foreground">
            Create and edit intake scripts with guided questions.
          </p>
        </div>
        <Button>New Script</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>PI Auto Accident</CardTitle>
          <CardDescription>
            12 questions — Last updated Apr 16, 2026
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button variant="outline" size="sm">Edit</Button>
          <Button variant="outline" size="sm">Preview</Button>
        </CardContent>
      </Card>
    </div>
  )
}
