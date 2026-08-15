import React, { useState } from 'react'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DatabaseBackup, RotateCcw, AlertTriangle, CheckCircle, Loader2, HardDriveDownload, History } from 'lucide-react'

export function BackupSettings() {
  const queryClient = useQueryClient()
  const [isRestoring, setIsRestoring] = useState(false)

  const { data: backups, isLoading } = useQuery({
    queryKey: ['backups'],
    queryFn: async () => {
      return await window.api.invoke(IPC_CHANNELS.BACKUP_LIST)
    }
  })

  const backupMutation = useMutation({
    mutationFn: async () => {
      return await window.api.invoke(IPC_CHANNELS.BACKUP_CREATE)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] })
      alert('Backup created successfully in your Documents folder!')
    },
    onError: (err: any) => {
      alert(`Failed to create backup: ${err.message}`)
    }
  })

  const restoreMutation = useMutation({
    mutationFn: async (path: string) => {
      setIsRestoring(true)
      return await window.api.invoke(IPC_CHANNELS.BACKUP_RESTORE, path)
    },
    onError: (err: any) => {
      setIsRestoring(false)
      alert(`Restore failed: ${err.message}`)
    }
  })

  const handleRestore = (path: string) => {
    if (confirm('WARNING: This will replace your current database and restart the application. Any unsaved data will be lost. Are you sure you want to proceed?')) {
      restoreMutation.mutate(path)
    }
  }

  return (
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
        <DatabaseBackup className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <h3 className="text-base font-bold text-slate-900">Database Backup & Disaster Recovery</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Safeguard your pharmacy business data with instant manual snapshots or restore from an existing database archive.
        </p>

        <div className="grid gap-4 md:grid-cols-2 mt-5">
          {/* Create Backup */}
          <div className="p-5 bg-slate-50 border border-slate-200/80 rounded-xl flex flex-col justify-between space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <HardDriveDownload className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-slate-900">Create Full Database Backup</h4>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  Takes a consistent point-in-time snapshot of products, batches, sales, and accounts.
                </p>
              </div>
            </div>
            <button
              onClick={() => backupMutation.mutate()}
              disabled={backupMutation.isPending}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {backupMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {backupMutation.isPending ? 'Backing up...' : 'Create Backup Snapshot Now'}
            </button>
          </div>

          {/* Restore Notice */}
          <div className="p-5 bg-rose-50/50 border border-rose-200 rounded-xl flex flex-col justify-between space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <RotateCcw className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-rose-900">Restore Database from File</h4>
                <p className="text-[11px] text-rose-700/80 mt-0.5 leading-relaxed">
                  Select a prior snapshot from the archive history below to roll back the system.
                </p>
              </div>
            </div>
            <div className="text-[11px] text-rose-700 font-semibold bg-rose-100/60 border border-rose-200/80 rounded-lg py-1.5 px-3 flex items-center justify-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Select a snapshot from the history list below
            </div>
          </div>
        </div>

        {/* Local Backup History */}
        <div className="mt-6 space-y-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-400" />
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Available Backup Archives</h4>
          </div>
          
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            {isLoading ? (
              <div className="p-6 text-center text-slate-400 text-xs font-medium">
                <Loader2 className="w-4 h-4 animate-spin mx-auto text-blue-600 mb-1" />
                Scanning backup repository...
              </div>
            ) : !backups || backups.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">
                No backup archives found. Click "Create Backup Snapshot Now" above to create your first backup.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-slate-400 font-bold uppercase text-[10px]">
                    <th className="py-2.5 px-3">Archive Filename</th>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3 text-right">Size</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {backups.map((b: any, i: number) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-800">{b.filename || b.name}</td>
                      <td className="py-2.5 px-3 text-slate-500">{b.created_at || b.date || '-'}</td>
                      <td className="py-2.5 px-3 text-right text-slate-600">{b.size ? `${(b.size / (1024 * 1024)).toFixed(2)} MB` : '-'}</td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => handleRestore(b.path)}
                          disabled={isRestoring}
                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg border border-rose-200 transition text-[11px]"
                        >
                          Restore
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {isRestoring && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center space-y-4 max-w-sm text-center border border-slate-200">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
              <h3 className="text-lg font-bold text-slate-900">Restoring Database Archive</h3>
              <p className="text-xs text-slate-500">
                Please wait while we verify database integrity and restore snapshots. The application will restart automatically.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
