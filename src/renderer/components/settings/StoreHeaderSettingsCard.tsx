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
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
        <Building2 className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Receipt & Invoice Header Information</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Customize pharmacy business details printed on thermal receipts, tax invoices, and regulatory reports.
              {!isOwner && <span className="text-amber-600 font-medium ml-1">(Owner privilege required to edit)</span>}
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center gap-2 py-8 text-slate-400 text-xs font-medium">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" /> Loading store settings...
          </div>
        ) : (
          <form onSubmit={handleSave} className="mt-5 space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Pharmacy / Store Name</label>
                <input
                  type="text"
                  disabled={!isOwner || isSaving}
                  value={formState.storeName}
                  onChange={(e) => setFormState({ ...formState, storeName: e.target.value })}
                  placeholder="e.g. SHIV SHAKTI MEDICAL STORE"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none bg-slate-50 font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Subtitle / Tagline</label>
                <input
                  type="text"
                  disabled={!isOwner || isSaving}
                  value={formState.storeSubtitle}
                  onChange={(e) => setFormState({ ...formState, storeSubtitle: e.target.value })}
                  placeholder="e.g. Chemist & Druggist"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none bg-slate-50 font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Location / Address</label>
              <input
                type="text"
                disabled={!isOwner || isSaving}
                value={formState.storeAddress}
                onChange={(e) => setFormState({ ...formState, storeAddress: e.target.value })}
                placeholder="e.g. Shop No. 14, Near Govt. Hospital, G.E. Road, Bhilai 3"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none bg-slate-50 font-medium"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Phone Number</label>
                <input
                  type="text"
                  disabled={!isOwner || isSaving}
                  value={formState.storePhone}
                  onChange={(e) => setFormState({ ...formState, storePhone: e.target.value })}
                  placeholder="e.g. 9131741818"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none bg-slate-50 font-mono font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Proprietor / Pharmacist Name</label>
                <input
                  type="text"
                  disabled={!isOwner || isSaving}
                  value={formState.storeProprietor}
                  onChange={(e) => setFormState({ ...formState, storeProprietor: e.target.value })}
                  placeholder="e.g. P. L. Sahu"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none bg-slate-50 font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  GSTIN <span className="text-[11px] text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  disabled={!isOwner || isSaving}
                  value={formState.storeGstin}
                  onChange={(e) => setFormState({ ...formState, storeGstin: e.target.value })}
                  placeholder="e.g. 22AAAAA0000A1Z5"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none bg-slate-50 uppercase font-mono font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Drug License No. (DL No.) <span className="text-[11px] text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  disabled={!isOwner || isSaving}
                  value={formState.storeDl}
                  onChange={(e) => setFormState({ ...formState, storeDl: e.target.value })}
                  placeholder="e.g. CG-BZ1-2023-001"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none bg-slate-50 uppercase font-mono font-medium"
                />
              </div>
            </div>

            {isOwner ? (
              <div className="flex items-center gap-3 pt-3">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save Store Details
                </button>

                {isSaved && (
                  <span className="text-xs text-emerald-600 font-bold flex items-center gap-1 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4" />
                    Receipt header updated
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 p-3 rounded-xl border border-amber-200 mt-4">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                Only users with OWNER role can modify store details and receipt formats.
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  )
}

