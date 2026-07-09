import React, { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { FileUp, Loader2, CheckCircle2, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'

interface ImportCsvModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function ImportCsvModal({ isOpen, onOpenChange }: ImportCsvModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [statusText, setStatusText] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!isOpen) {
      // Reset state when closed
      setFile(null)
      setProgress(0)
      setStatusText('')
      setImporting(false)
      setResult(null)
      setError(null)
    }
  }, [isOpen])

  useEffect(() => {
    // Listen for progress updates from the worker via IPC
    const removeListener = window.api.on(IPC_CHANNELS.IMPORT_PROGRESS, (msg: any) => {
      setProgress(msg.percent)
      setStatusText(msg.message)
    })
    
    return () => removeListener()
  }, [])

  const handleImport = async () => {
    if (!file) return
    
    // In Electron, File objects have a path property
    const path = (file as any).path
    if (!path) {
      setError('Could not resolve file path. Must run in Electron.')
      return
    }

    setImporting(true)
    setError(null)
    setProgress(0)
    setStatusText('Starting worker...')

    try {
      const res = await window.api.invoke(IPC_CHANNELS.IMPORT_CSV, path)
      setResult(res)
      queryClient.invalidateQueries({ queryKey: ['products'] })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setImporting(false)
      setProgress(100)
    }
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-xl">
          <div className="flex flex-col mb-4">
            <Dialog.Title className="text-xl font-semibold leading-none tracking-tight">
              Import Products CSV
            </Dialog.Title>
            <Dialog.Description className="text-sm text-muted-foreground mt-2">
              Upload a CSV file containing your product catalog.
            </Dialog.Description>
          </div>

          {!importing && !result && (
            <div className="flex flex-col gap-4">
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <FileUp className="w-8 h-8 mb-3 text-muted-foreground" />
                  <p className="mb-2 text-sm text-muted-foreground">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground">CSV (MAX. 50MB)</p>
                </div>
                <input 
                  type="file" 
                  className="hidden" 
                  accept=".csv"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>

              {file && (
                <div className="text-sm px-3 py-2 bg-muted rounded-md border flex items-center justify-between">
                  <span className="truncate">{file.name}</span>
                  <span className="text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</span>
                </div>
              )}

              {error && (
                <p className="text-sm text-red-500 animate-in shake">
                  {error}
                </p>
              )}

              <button
                onClick={handleImport}
                disabled={!file}
                className="w-full flex items-center justify-center h-10 px-4 mt-2 text-primary-foreground bg-primary rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                Start Import
              </button>
            </div>
          )}

          {importing && (
            <div className="flex flex-col items-center justify-center py-8 space-y-6">
              <div className="w-full max-w-xs space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{statusText}</span>
                  <span className="font-medium">{progress}%</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300 ease-in-out" 
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {result && (
            <div className="flex flex-col items-center justify-center py-6 space-y-4">
              <div className="p-3 bg-green-100 text-green-600 rounded-full">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-lg font-medium">Import Complete</h3>
              <div className="w-full space-y-2 text-sm bg-muted p-4 rounded-md">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Rows:</span>
                  <span className="font-medium">{result.total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Imported:</span>
                  <span className="font-medium text-green-600">{result.processed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Skipped (Dupes/Empty):</span>
                  <span className="font-medium text-orange-500">{result.skipped}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Errors:</span>
                  <span className="font-medium text-red-500">{result.errors}</span>
                </div>
              </div>
            </div>
          )}

          <Dialog.Close asChild>
            <button className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
