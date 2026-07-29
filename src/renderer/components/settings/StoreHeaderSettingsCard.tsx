import React, { useState, useEffect } from 'react'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { useAuthStore } from '../../store/auth.store'
import { Building2, Save, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react'

export function StoreHeaderSettingsCard() {
  const { user } = useAuthStore()
  const isOwner = user?.role === 'OWNER'

  const [formState, setFormState] = useState({
    storeName: 'SHIV SHAKTI MEDICAL STORE',
    storeSubtitle: 'Chemist & Druggist',
    storeAddress: 'Shop No. 14, Near Govt. Hospital, G.E. Road, Bhilai 3',
    storePhone: '9131741818',
    storeProprietor: 'P. L. Sahu',
    storeGstin: '',
    storeDl: ''
  })

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api.invoke(IPC_CHANNELS.SETTINGS_GET)
      .then((data: any) => {
        if (data) {
          setFormState({
            storeName: data.storeName || 'SHIV SHAKTI MEDICAL STORE',
            storeSubtitle: data.storeSubtitle || 'Chemist & Druggist',
            storeAddress: data.storeAddress || '',
            storePhone: data.storePhone || '',
            storeProprietor: data.storeProprietor || '',
            storeGstin: data.storeGstin || '',
            storeDl: data.storeDl || ''
          })
        }
      })
      .catch((err) => console.error('Failed to load store settings:', err))
      .finally(() => setIsLoading(false))
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isOwner) return

    setIsSaving(true)
    setError(null)
    setIsSaved(false)

    try {
      await window.api.invoke(IPC_CHANNELS.SETTINGS_SET, formState)
      setIsSaved(true)
      setTimeout(() => setIsSaved(false), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to save store header settings.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex items-start gap-5">
      <div className="p-3 bg-primary/10 text-primary rounded-xl">
        <Building2 className="w-6 h-6" />
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Bill & Store Header Format</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Customize shop header information printed on thermal receipts and tax invoices.
              {!isOwner && <span className="text-amber-600 font-medium ml-1">(Owner privilege required to edit)</span>}
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 text-sm text-red-500 bg-red-500/10 rounded-md">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center gap-2 py-6 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading store settings...
          </div>
        ) : (
          <form onSubmit={handleSave} className="mt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Store / Shop Name</label>
                <input
                  type="text"
                  disabled={!isOwner || isSaving}
                  value={formState.storeName}
                  onChange={(e) => setFormState({ ...formState, storeName: e.target.value })}
                  placeholder="e.g. SHIV SHAKTI MEDICAL STORE"
                  className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Subtitle / Tagline</label>
                <input
                  type="text"
                  disabled={!isOwner || isSaving}
                  value={formState.storeSubtitle}
                  onChange={(e) => setFormState({ ...formState, storeSubtitle: e.target.value })}
                  placeholder="e.g. Chemist & Druggist"
                  className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Location / Address</label>
              <input
                type="text"
                disabled={!isOwner || isSaving}
                value={formState.storeAddress}
                onChange={(e) => setFormState({ ...formState, storeAddress: e.target.value })}
                placeholder="e.g. Shop No. 14, Near Govt. Hospital, G.E. Road, Bhilai 3"
                className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Phone Number</label>
                <input
                  type="text"
                  disabled={!isOwner || isSaving}
                  value={formState.storePhone}
                  onChange={(e) => setFormState({ ...formState, storePhone: e.target.value })}
                  placeholder="e.g. 9131741818"
                  className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Proprietor Name</label>
                <input
                  type="text"
                  disabled={!isOwner || isSaving}
                  value={formState.storeProprietor}
                  onChange={(e) => setFormState({ ...formState, storeProprietor: e.target.value })}
                  placeholder="e.g. P. L. Sahu"
                  className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">GSTIN <span className="text-xs text-muted-foreground font-normal">(Optional - leave empty to hide on receipt)</span></label>
                <input
                  type="text"
                  disabled={!isOwner || isSaving}
                  value={formState.storeGstin}
                  onChange={(e) => setFormState({ ...formState, storeGstin: e.target.value })}
                  placeholder="e.g. 22AAAAA0000A1Z5"
                  className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background uppercase font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Drug License No. (DL No.) <span className="text-xs text-muted-foreground font-normal">(Optional - leave empty to hide on receipt)</span></label>
                <input
                  type="text"
                  disabled={!isOwner || isSaving}
                  value={formState.storeDl}
                  onChange={(e) => setFormState({ ...formState, storeDl: e.target.value })}
                  placeholder="e.g. CG-BZ1-2023-001"
                  className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background uppercase font-mono"
                />
              </div>
            </div>

            {isOwner ? (
              <div className="flex items-center gap-4 pt-4">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white transition-colors rounded-md bg-primary hover:bg-primary/90 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Store Details
                </button>

                {isSaved && (
                  <span className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4" />
                    Receipt header updated
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-500/10 p-3 rounded-md border border-amber-200 mt-4">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                Only users with OWNER permissions can modify receipt header & store details.
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
