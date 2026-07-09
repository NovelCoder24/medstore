import React, { useState } from 'react'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DatabaseBackup, RotateCcw, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react'

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
      alert('Backup created successfully!')
    },
    onError: (err: any) => {
      alert(`Failed to create backup: ${err.message}`)
    }
  })

  const restoreMutation = useMutation({
    mutationFn: async (path: string) => {
      setIsRestoring(true)
      // This will restart the app on success, so we won't see onSuccess
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
    <div className="flex items-start gap-5">
      <div className="p-3 bg-primary/10 text-primary rounded-xl shrink-0">
        <DatabaseBackup className="w-6 h-6" />
      </div>
      <div className="flex-1">
        <h2 className="text-lg font-semibold tracking-tight">Data Backup & Restore</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Securely backup your database or restore from a previous snapshot.
        </p>

        <div className="grid gap-6 md:grid-cols-2 mt-6">
          <div className="p-6 bg-muted/30 rounded-xl flex flex-col items-center text-center space-y-4">
            <div className="p-4 bg-primary/10 rounded-full text-primary">
              <DatabaseBackup className="w-8 h-8" />
            </div>
          <div>
            <h3 className="font-semibold text-lg">Create Manual Backup</h3>
            <p className="text-sm text-muted-foreground mt-1 px-4">
              Takes a consistent snapshot of your active database and saves it securely to your Documents folder.
            </p>
          </div>
          <button
            onClick={() => backupMutation.mutate()}
            disabled={backupMutation.isPending}
            className="w-full max-w-xs mt-auto bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
          >
            {backupMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {backupMutation.isPending ? 'Backing up...' : 'Create Backup Now'}
          </button>
        </div>

        <div className="p-6 bg-destructive/5 rounded-xl flex flex-col items-center text-center space-y-4">
          <div className="p-4 bg-destructive/10 rounded-full text-destructive">
            <RotateCcw className="w-8 h-8" />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-destructive">Restore from File</h3>
            <p className="text-sm text-muted-foreground mt-1 px-4">
              Select a previous backup file to restore. The system will perform an integrity check before replacing the database.
            </p>
          </div>
          {/* Note: Normally you'd have a file picker here, but for simplicity we rely on the list below */}
          <div className="w-full max-w-xs mt-auto flex items-center justify-center text-sm text-destructive font-medium border border-destructive/20 rounded-md py-2 bg-destructive/10">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Select a backup from the list below
          </div>
        </div>
      </div>

      <div className="mt-10 space-y-3">
        <h3 className="text-base font-semibold tracking-tight text-foreground">Local Backup History</h3>
        <div className="overflow-hidden border-t border-muted/60">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-muted/40 text-muted-foreground">
              <th className="px-4 py-3 font-medium">Filename</th>
              <th className="px-4 py-3 font-medium">Date Created</th>
              <th className="px-4 py-3 font-medium">Size</th>
              <th className="px-4 py-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                </td>
              </tr>
            ) : !backups || backups.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  No local backups found in Documents/medstore-backups
                </td>
              </tr>
            ) : (
              backups.map((b: any) => (
                <tr key={b.path} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{b.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(b.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {(b.size / 1024 / 1024).toFixed(2)} MB
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleRestore(b.path)}
                      disabled={isRestoring}
                      className="px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 border border-destructive/20 rounded disabled:opacity-50 transition-colors"
                    >
                      {isRestoring ? 'Restoring...' : 'Restore'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>
      </div>

        {isRestoring && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-background p-8 rounded-lg shadow-2xl flex flex-col items-center space-y-4 max-w-sm text-center">
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <h3 className="text-xl font-bold">Restoring Database</h3>
              <p className="text-sm text-muted-foreground">
                Please wait while we verify integrity and restore your data. The application will restart automatically.
              </p>
            </div>
          </div>
        )}
      </div>
    )
  }
