import React from 'react'

export function App() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
      <div className="rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-3xl font-bold tracking-tight text-primary">
          MedStore POS
        </h1>
        <p className="mt-2 text-muted-foreground">
          Phase 0: Foundation Complete
        </p>
        <div className="mt-6 flex gap-4">
          <div className="rounded-md bg-muted px-4 py-2 text-sm font-medium">
            Electron: {window.api ? 'Connected' : 'Missing'}
          </div>
          <div className="rounded-md bg-muted px-4 py-2 text-sm font-medium">
            Tailwind 4: Active
          </div>
        </div>
      </div>
    </div>
  )
}
