import React, { useState, useEffect } from 'react'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { Sparkles, Download, RefreshCw, X } from 'lucide-react'

interface UpdateInfo {
  status: 'available' | 'downloading' | 'ready'
  version?: string
  percent?: number
}

export function UpdateNotification() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    const unsubscribe = window.api.on(IPC_CHANNELS.UPDATER_STATUS, (data: UpdateInfo) => {
      setUpdateInfo(data)
      setDismissed(false)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  if (!updateInfo || dismissed) return null

  const handleRestart = async () => {
    setInstalling(true)
    try {
      await window.api.invoke(IPC_CHANNELS.UPDATER_QUIT_AND_INSTALL)
    } catch (err) {
      console.error('Failed to install update:', err)
      setInstalling(false)
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700/80 p-4 transition-all duration-300 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
            {updateInfo.status === 'downloading' ? (
              <Download className="w-4 h-4 animate-bounce" />
            ) : updateInfo.status === 'ready' ? (
              <Sparkles className="w-4 h-4 text-emerald-400" />
            ) : (
              <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
            )}
          </div>
          <div>
            <h4 className="text-xs font-bold text-white tracking-tight">
              {updateInfo.status === 'ready'
                ? `Update Ready (v${updateInfo.version || ''})`
                : updateInfo.status === 'downloading'
                ? `Downloading Update (${updateInfo.percent || 0}%)`
                : `Update Available (v${updateInfo.version || ''})`}
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {updateInfo.status === 'ready'
                ? 'Restart now to apply new features and security fixes.'
                : updateInfo.status === 'downloading'
                ? 'Downloading the latest version in background...'
                : 'A new version of MedStore has been detected.'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {updateInfo.status === 'downloading' && (
        <div className="mt-3 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-blue-500 h-1.5 transition-all duration-300 rounded-full"
            style={{ width: `${updateInfo.percent || 0}%` }}
          />
        </div>
      )}

      {updateInfo.status === 'ready' && (
        <div className="mt-3 pt-3 border-t border-slate-800 flex justify-end gap-2">
          <button
            onClick={() => setDismissed(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
          >
            Later
          </button>
          <button
            onClick={handleRestart}
            disabled={installing}
            className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${installing ? 'animate-spin' : ''}`} />
            {installing ? 'Restarting...' : 'Restart & Update'}
          </button>
        </div>
      )}
    </div>
  )
}
