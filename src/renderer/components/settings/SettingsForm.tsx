import React, { useState, useEffect } from 'react'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { Settings, KeyRound, Loader2, Save, CheckCircle2, FileSpreadsheet, Download, Sparkles } from 'lucide-react'
import { BackupSettings } from './BackupSettings'
import { StoreHeaderSettingsCard } from './StoreHeaderSettingsCard'

export function SettingsForm() {
  const [apiKey, setApiKey] = useState('')
  const [isSaved, setIsSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [hasExistingKey, setHasExistingKey] = useState(false)
  const [selectedModel, setSelectedModel] = useState('gemini-3.7-flash')
  const [error, setError] = useState<string | null>(null)
  
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7)) // YYYY-MM
  const [isExportingGst, setIsExportingGst] = useState(false)

  useEffect(() => {
    // Check if key is already set
    window.api.invoke(IPC_CHANNELS.SETTINGS_GET_SECRET, 'GEMINI_API_KEY')
      .then((exists) => setHasExistingKey(exists))
      .catch((err) => console.error('Failed to check API key:', err))

    // Fetch saved model preference
    window.api.invoke(IPC_CHANNELS.SETTINGS_GET_VALUE, 'GEMINI_MODEL')
      .then((model) => {
        if (model) setSelectedModel(model)
      })
      .catch((err) => console.error('Failed to get GEMINI_MODEL:', err))
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    setIsSaving(true)
    setError(null)
    setIsSaved(false)

    try {
      if (apiKey.trim()) {
        await window.api.invoke(IPC_CHANNELS.SETTINGS_SET_SECRET, 'GEMINI_API_KEY', apiKey.trim())
        setHasExistingKey(true)
        setApiKey('') // Clear the input field for security
      }

      await window.api.invoke(IPC_CHANNELS.SETTINGS_SET_VALUE, 'GEMINI_MODEL', selectedModel)
      
      setIsSaved(true)
      setTimeout(() => setIsSaved(false), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to save API Key securely.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12 font-sans">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Pharmacy & System Settings</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Configure store receipt headers, drug license compliance, AI invoice extraction, and automatic database backups.
        </p>
      </div>

      {/* 1. OCR Integration (Gemini AI) */}
      <section className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
            <KeyRound className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">AI Invoice OCR Integration</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure your Google Gemini API Key and model preferences for automatic purchase bill extraction.
                </p>
              </div>
              {hasExistingKey && !isSaved && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" /> API Key Encrypted & Active
                </span>
              )}
            </div>

            {error && (
              <div className="mt-4 p-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl">
                {error}
              </div>
            )}

            <form onSubmit={handleSave} className="mt-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">Gemini API Key</label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={hasExistingKey ? "•••••••••••••••• (Enter new key to overwrite)" : "Paste your API key here..."}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none bg-slate-50 font-mono"
                    disabled={isSaving}
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">Preferred Gemini Model</label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    disabled={isSaving}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none bg-slate-50 font-medium"
                  >
                    <option value="gemini-3.7-flash">gemini-3.7-flash (Default - Fast & High Accuracy)</option>
                    <option value="gemini-3.5-flash">gemini-3.5-flash (Balanced & High Efficiency)</option>
                    <option value="gemini-3.5-flash-lit">gemini-3.5-flash-lit (Lightweight & Ultra Fast)</option>
                  </select>
                </div>
              </div>

              <p className="text-[11px] text-slate-400">
                Note: In case of network rate limits or heavy cloud traffic, the system automatically falls back to <strong>gemini-3.5-flash</strong> to avoid interrupting your workflow.
              </p>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save AI Settings
                </button>

                {isSaved && (
                  <span className="text-xs text-emerald-600 font-bold flex items-center gap-1 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4" />
                    AI settings saved securely
                  </span>
                )}
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* 2. Store Header & Bill Format */}
      <section className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        <StoreHeaderSettingsCard />
      </section>

      {/* 3. GST Reports (GSTR-1) */}
      <section className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-slate-900">GST Compliance Reports (GSTR-1)</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Export your monthly B2C tax invoice records and sales returns into official government GST CSV format.
            </p>

            <div className="mt-5 flex items-end gap-3 max-w-md">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Select Month</label>
                <input
                  type="month"
                  value={reportMonth}
                  onChange={(e) => setReportMonth(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none bg-slate-50 font-medium"
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
                className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50 h-9"
              >
                {isExportingGst ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Export GSTR-1 CSV
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Backup & Restore */}
      <section className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        <BackupSettings />
      </section>
    </div>
  )
}

