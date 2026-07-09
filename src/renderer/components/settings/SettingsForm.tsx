import React, { useState, useEffect } from 'react'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { Settings, KeyRound, Loader2, Save, CheckCircle2, FileSpreadsheet, Download } from 'lucide-react'
import { BackupSettings } from './BackupSettings'

export function SettingsForm() {
  const [apiKey, setApiKey] = useState('')
  const [isSaved, setIsSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [hasExistingKey, setHasExistingKey] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7)) // YYYY-MM
  const [isExportingGst, setIsExportingGst] = useState(false)

  useEffect(() => {
    // Check if key is already set
    window.api.invoke(IPC_CHANNELS.SETTINGS_GET_SECRET, 'GEMINI_API_KEY')
      .then((exists) => setHasExistingKey(exists))
      .catch((err) => console.error('Failed to check API key:', err))
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!apiKey.trim()) return

    setIsSaving(true)
    setError(null)
    setIsSaved(false)

    try {
      await window.api.invoke(IPC_CHANNELS.SETTINGS_SET_SECRET, 'GEMINI_API_KEY', apiKey.trim())
      setIsSaved(true)
      setHasExistingKey(true)
      setApiKey('') // Clear the input field for security
      
      setTimeout(() => setIsSaved(false), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to save API Key securely.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-background overflow-auto items-center">
      {/* Header */}
      <div className="w-full border-b bg-card">
        <div className="max-w-4xl mx-auto flex items-center gap-3 p-6">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">System Settings</h1>
            <p className="text-sm text-muted-foreground">Configure application preferences and integrations</p>
          </div>
        </div>
      </div>

      <div className="w-full max-w-4xl px-8 py-10 space-y-12">
        
        {/* OCR Settings Section */}
        <section className="pb-12 border-b border-muted/60">
          <div className="flex items-start gap-5">
            <div className="p-3 bg-primary/10 text-primary rounded-xl">
              <KeyRound className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold tracking-tight">OCR Integration (Gemini AI)</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Configure your Google Gemini API Key to enable automated invoice extraction.
                Your key is encrypted using OS-level secure storage (safeStorage) and never leaves your device.
              </p>

              {hasExistingKey && !isSaved && (
                <div className="flex items-center gap-2 mt-4 text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 p-3 rounded-md border border-emerald-200 dark:border-emerald-500/20">
                  <CheckCircle2 className="w-4 h-4" />
                  API Key is currently configured and secured.
                </div>
              )}

              {error && (
                <div className="mt-4 p-3 text-sm text-red-500 bg-red-500/10 rounded-md">
                  {error}
                </div>
              )}

              <form onSubmit={handleSave} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Gemini API Key</label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={hasExistingKey ? "•••••••••••••••• (Enter new key to overwrite)" : "Paste your API key here..."}
                    className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background font-mono"
                    disabled={isSaving}
                  />
                </div>

                <div className="flex items-center gap-4">
                  <button
                    type="submit"
                    disabled={isSaving || !apiKey.trim()}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white transition-colors rounded-md bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {hasExistingKey ? 'Update Key' : 'Save Key'}
                  </button>

                  {isSaved && (
                    <span className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 animate-in fade-in">
                      <CheckCircle2 className="w-4 h-4" />
                      Saved securely
                    </span>
                  )}
                </div>
              </form>
            </div>
          </div>
        </section>
        
        {/* Backup Settings Section */}
        <section className="pb-12 border-b border-muted/60">
          <BackupSettings />
        </section>

        {/* GST Reports Section */}
        <section>
          <div className="flex items-start gap-5">
            <div className="p-3 bg-primary/10 text-primary rounded-xl">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold tracking-tight">GST Reports (GSTR-1)</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Export your monthly GSTR-1 sales data in CSV format for tax filing.
              </p>

              <div className="mt-6 flex items-end gap-4">
                <div className="space-y-2 flex-1 max-w-xs">
                  <label className="text-sm font-medium">Select Month</label>
                  <input
                    type="month"
                    value={reportMonth}
                    onChange={(e) => setReportMonth(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background"
                  />
                </div>
                <button
                  onClick={async () => {
                    if (!reportMonth) return
                    setIsExportingGst(true)
                    try {
                      const csvContent = await window.api.invoke(IPC_CHANNELS.REPORTS_GSTR1, reportMonth)
                      const blob = new Blob([csvContent], { type: 'text/csv' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `GSTR1_${reportMonth}.csv`
                      document.body.appendChild(a)
                      a.click()
                      document.body.removeChild(a)
                      URL.revokeObjectURL(url)
                    } catch (err) {
                      alert('Failed to generate GST report')
                    } finally {
                      setIsExportingGst(false)
                    }
                  }}
                  disabled={isExportingGst || !reportMonth}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white transition-colors rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 h-10"
                >
                  {isExportingGst ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Export CSV
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
