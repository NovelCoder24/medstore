import React, { useState, useEffect, useRef } from 'react'
import {
  UploadCloud,
  FileText,
  Clock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  Trash2,
  Sparkles,
  ArrowRight,
  Filter,
  CheckCheck,
  ClipboardPaste
} from 'lucide-react'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { toast } from '../../store/toast.store'
import { confirmModal } from '../../store/confirm.store'
import type {
  OcrQueueSummaryItem,
  OcrQueueItem,
  OcrQueueStatus,
  OcrQueueProgressEvent,
  OcrQueueUpdateEvent,
  DailyOcrUsage
} from '../../../shared/types'
import { formatPaise, toPaise } from '../../../shared/utils/paise'

interface OcrReviewQueueProps {
  onOpenItemForReview: (queueItem: OcrQueueItem) => void | Promise<void>
}

export function OcrReviewQueue({ onOpenItemForReview }: OcrReviewQueueProps) {
  const [items, setItems] = useState<OcrQueueSummaryItem[]>([])
  const [dailyUsage, setDailyUsage] = useState<DailyOcrUsage | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [openingItemId, setOpeningItemId] = useState<number | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [skippedNotice, setSkippedNotice] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [progressEvent, setProgressEvent] = useState<OcrQueueProgressEvent | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadQueue = async () => {
    try {
      const [list, usage] = await Promise.all([
        window.api.invoke(IPC_CHANNELS.OCR_QUEUE_LIST),
        window.api.invoke(IPC_CHANNELS.OCR_GET_DAILY_USAGE).catch(() => null)
      ])
      setItems(list || [])
      if (usage) setDailyUsage(usage)
    } catch (err) {
      console.error('Failed to load OCR queue list:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadQueue()

    // Listen to real-time lightweight status push updates
    const unsubscribeUpdate = window.api.on(IPC_CHANNELS.OCR_QUEUE_UPDATED, (_event: OcrQueueUpdateEvent) => {
      loadQueue()
    })

    // Listen to real-time progress & ETA countdown events
    const unsubscribeProgress = window.api.on(IPC_CHANNELS.OCR_QUEUE_PROGRESS, (progress: OcrQueueProgressEvent) => {
      setProgressEvent(progress)
    })

    // Listen to global clipboard paste for invoice photos / PDFs
    const handleGlobalPaste = async (e: ClipboardEvent) => {
      const clipboardItems = e.clipboardData?.items
      if (!clipboardItems) return

      const files: File[] = []
      for (let i = 0; i < clipboardItems.length; i++) {
        const item = clipboardItems[i]
        if (item.type.indexOf('image') !== -1 || item.type === 'application/pdf') {
          const file = item.getAsFile()
          if (file) {
            const ext = file.type === 'application/pdf' ? 'pdf' : (file.type.split('/')[1] || 'png')
            const cleanName = file.name && file.name !== 'image.png'
              ? file.name
              : `pasted_invoice_${Date.now()}.${ext}`
            const renamed = new File([file], cleanName, { type: file.type })
            files.push(renamed)
          }
        }
      }

      if (files.length > 0) {
        e.preventDefault()
        await handleFilesUpload(files)
      }
    }

    window.addEventListener('paste', handleGlobalPaste)

    return () => {
      unsubscribeUpdate()
      unsubscribeProgress()
      window.removeEventListener('paste', handleGlobalPaste)
    }
  }, [])

  const handleFilesUpload = async (fileList: FileList | File[]) => {
    if (!fileList || fileList.length === 0) return

    setIsUploading(true)
    setUploadError(null)
    setSkippedNotice(null)

    try {
      const filesPayload: Array<{ name: string; buffer: ArrayBuffer; mimeType: string }> = []

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i]
        const buffer = await file.arrayBuffer()
        filesPayload.push({
          name: file.name,
          buffer,
          mimeType: file.type || 'image/jpeg'
        })
      }

      const res = await window.api.invoke(IPC_CHANNELS.OCR_QUEUE_ENQUEUE, { files: filesPayload })

      if (res.skippedCount > 0) {
        const reasons = res.skippedItems.map((s: any) => `${s.fileName}: ${s.reason}`).join(' | ')
        setSkippedNotice(`Skipped ${res.skippedCount} duplicate/invalid file(s): ${reasons}`)
      }

      await loadQueue()
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload invoices to queue')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesUpload(e.dataTransfer.files)
    }
  }

  const handleReviewItem = async (summaryItem: OcrQueueSummaryItem) => {
    setOpeningItemId(summaryItem.id)
    try {
      const fullItem: OcrQueueItem = await window.api.invoke(IPC_CHANNELS.OCR_QUEUE_GET, summaryItem.id)
      if (!fullItem) {
        toast.error('Invoice not found', { description: `Invoice #${summaryItem.id} could not be retrieved from the queue.` })
        return
      }
      if (!fullItem.extractedData) {
        toast.warning('Extraction incomplete', { description: `Invoice #${summaryItem.id} does not have any extracted data.` })
        return
      }
      await onOpenItemForReview(fullItem)
    } catch (err: any) {
      console.error(`Failed to get full details for queue item #${summaryItem.id}:`, err)
      toast.error('Failed to open invoice', { description: err?.message || 'Unknown error' })
    } finally {
      setOpeningItemId(null)
    }
  }

  const handleRetry = async (id: number) => {
    try {
      await window.api.invoke(IPC_CHANNELS.OCR_QUEUE_RETRY, id)
      toast.info('Invoice queued for retry')
      await loadQueue()
    } catch (err: any) {
      console.error('Failed to retry item:', err)
      toast.error('Failed to retry item', { description: err?.message })
    }
  }

  const handleDelete = async (id: number) => {
    const confirmed = await confirmModal({
      title: 'Delete Queue Item',
      message: 'Are you sure you want to remove this invoice from the queue?',
      confirmLabel: 'Delete',
      variant: 'danger'
    })
    if (confirmed) {
      try {
        await window.api.invoke(IPC_CHANNELS.OCR_QUEUE_DELETE, id)
        toast.success('Invoice removed from queue')
        await loadQueue()
      } catch (err: any) {
        console.error('Failed to delete item:', err)
        toast.error('Failed to delete item', { description: err?.message })
      }
    }
  }

  const handleClearCompleted = async () => {
    try {
      await window.api.invoke(IPC_CHANNELS.OCR_QUEUE_CLEAR_COMPLETED)
      toast.success('Completed items cleared')
      await loadQueue()
    } catch (err: any) {
      console.error('Failed to clear completed items:', err)
      toast.error('Failed to clear completed items', { description: err?.message })
    }
  }

  const filteredItems = items.filter(item => {
    if (statusFilter === 'ALL') return true
    return item.status === statusFilter
  })

  const readyCount = items.filter(i => i.status === 'READY').length
  const processingCount = items.filter(i => i.status === 'PROCESSING').length
  const pendingCount = items.filter(i => i.status === 'PENDING').length
  const failedCount = items.filter(i => i.status === 'FAILED').length
  const approvedCount = items.filter(i => i.status === 'APPROVED').length

  const isQueueActive = progressEvent?.status === 'PROCESSING' || processingCount > 0 || pendingCount > 0

  return (
    <div className="flex flex-col h-full bg-background space-y-6 p-6 overflow-y-auto">
      {/* Daily AI Usage Banner */}
      {dailyUsage && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-muted/40 border rounded-xl text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-muted-foreground">Daily AI Scans:</span>
            <span className={`inline-flex items-center gap-1 font-bold px-2.5 py-0.5 rounded-full border text-[11px] ${
              dailyUsage.isAtLimit
                ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900'
                : dailyUsage.isApproachingLimit
                ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900'
            }`}>
              {dailyUsage.isAtLimit ? '🛑' : dailyUsage.isApproachingLimit ? '⚠️' : '⚡'}
              {dailyUsage.count} / {dailyUsage.limit} used today
            </span>
          </div>

          {dailyUsage.isApproachingLimit && !dailyUsage.isAtLimit && (
            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
              ⚠️ Approaching daily free tier limit ({dailyUsage.limit - dailyUsage.count} scans remaining today)
            </span>
          )}

          {dailyUsage.isAtLimit && (
            <span className="text-[11px] font-bold text-red-600 dark:text-red-400">
              Daily quota limit reached. Please use manual inward entry or resume scans tomorrow.
            </span>
          )}
        </div>
      )}

      {/* Upload Zone & Actions Banner */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="border-2 border-dashed border-primary/30 hover:border-primary/70 bg-primary/5 hover:bg-primary/10 transition-all rounded-xl p-6 text-center cursor-pointer relative"
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => e.target.files && handleFilesUpload(e.target.files)}
        />
        <div className="flex flex-col items-center justify-center space-y-2">
          <div className="p-3 bg-primary/10 rounded-full text-primary">
            {isUploading ? <Loader2 className="w-8 h-8 animate-spin" /> : <UploadCloud className="w-8 h-8" />}
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">
              {isUploading ? 'Adding Invoices to Queue...' : 'Drag & Drop Multiple Invoice Photos / PDFs Here'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              or click to browse from computer (Select 5, 10, or 20 files at once). Duplicate files are skipped automatically.
            </p>
            <div
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-background/80 dark:bg-background/40 border px-3 py-1 rounded-full mt-2.5 font-medium shadow-2xs"
              title="Copy an invoice photo from WhatsApp Web and press Ctrl+V anywhere in this view!"
            >
              <ClipboardPaste className="w-3.5 h-3.5 text-primary" />
              <span>or press <kbd className="px-1.5 py-0.5 text-[10px] font-bold bg-muted text-foreground rounded border">Ctrl+V</kbd> to paste invoice image from WhatsApp Web / clipboard</span>
            </div>
          </div>
        </div>
      </div>

      {/* Notices */}
      {uploadError && (
        <div className="p-3 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
          <span>⚠️ {uploadError}</span>
          <button onClick={() => setUploadError(null)} className="text-red-900 underline">Dismiss</button>
        </div>
      )}

      {skippedNotice && (
        <div className="p-3 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
          <span>ℹ️ {skippedNotice}</span>
          <button onClick={() => setSkippedNotice(null)} className="text-amber-900 underline">Dismiss</button>
        </div>
      )}

      {/* Live Progress & ETA Countdown Banner */}
      {isQueueActive && (
        <div className="p-4 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl space-y-2.5 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-blue-900 dark:text-blue-200">
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
              <span>
                Processing invoice {progressEvent?.currentIndex || 1} of {progressEvent?.totalCount || (pendingCount + processingCount)}
              </span>
              {progressEvent?.currentFileName && (
                <span className="text-xs font-normal text-blue-700 dark:text-blue-300 font-mono">
                  ({progressEvent.currentFileName})
                </span>
              )}
            </div>

            <div className="text-xs font-semibold text-blue-800 dark:text-blue-300">
              ⏱️ ~{Math.max(1, Math.round((progressEvent?.estimatedSecondsRemaining || (pendingCount * 12)) / 60))} min remaining
              {' '}({progressEvent?.estimatedSecondsRemaining || pendingCount * 12}s)
            </div>
          </div>

          {/* Animated Progress Bar */}
          <div className="w-full bg-blue-200 dark:bg-blue-900 h-2 rounded-full overflow-hidden">
            <div
              className="bg-primary h-full transition-all duration-500 rounded-full"
              style={{
                width: `${
                  progressEvent && progressEvent.totalCount > 0
                    ? Math.round(((progressEvent.totalCount - progressEvent.pendingCount) / progressEvent.totalCount) * 100)
                    : 15
                }%`
              }}
            />
          </div>
        </div>
      )}

      {/* Filter Tabs & Completed Cleanup */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              statusFilter === 'ALL' ? 'bg-primary text-white shadow-sm' : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            All ({items.length})
          </button>
          <button
            onClick={() => setStatusFilter('READY')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
              statusFilter === 'READY' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Ready for Review ({readyCount})</span>
          </button>
          <button
            onClick={() => setStatusFilter('PROCESSING')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
              statusFilter === 'PROCESSING' ? 'bg-blue-600 text-white shadow-sm' : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Processing ({processingCount})</span>
          </button>
          <button
            onClick={() => setStatusFilter('PENDING')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
              statusFilter === 'PENDING' ? 'bg-amber-600 text-white shadow-sm' : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            <span>Pending ({pendingCount})</span>
          </button>
          {failedCount > 0 && (
            <button
              onClick={() => setStatusFilter('FAILED')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                statusFilter === 'FAILED' ? 'bg-red-600 text-white shadow-sm' : 'bg-red-50 text-red-800 hover:bg-red-100'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Failed ({failedCount})</span>
            </button>
          )}
          {approvedCount > 0 && (
            <button
              onClick={() => setStatusFilter('APPROVED')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                statusFilter === 'APPROVED' ? 'bg-muted text-foreground' : 'bg-muted/50 text-muted-foreground'
              }`}
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Inwarded ({approvedCount})</span>
            </button>
          )}
        </div>

        {approvedCount > 0 && (
          <button
            type="button"
            onClick={handleClearCompleted}
            className="text-xs text-muted-foreground hover:text-foreground font-medium underline"
          >
            Clear Completed Invoices
          </button>
        )}
      </div>

      {/* Queue Items List */}
      <div className="flex-1 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center p-12 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span>Loading invoice queue...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground border rounded-xl bg-card">
            <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-semibold">No invoices in this view.</p>
            <p className="text-xs mt-1">Upload images or PDFs above to start batch OCR processing.</p>
          </div>
        ) : (
          filteredItems.map(item => (
            <div
              key={item.id}
              className="p-4 border rounded-xl bg-card hover:border-primary/40 transition-all flex flex-wrap items-center justify-between gap-4 shadow-sm"
            >
              {/* Left Column: File Details & Preview */}
              <div className="flex items-center gap-3.5 min-w-[240px]">
                <div className="p-2.5 bg-muted rounded-lg text-primary">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-foreground truncate max-w-[260px]" title={item.fileName}>
                      {item.fileName}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                      #{item.id}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Added: {item.createdAt} • {(item.fileSizeBytes / 1024).toFixed(0)} KB
                  </p>
                </div>
              </div>

              {/* Middle Column: Extracted Metadata & Flags */}
              <div className="flex-1 min-w-[220px]">
                {item.status === 'READY' || item.status === 'APPROVED' ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground truncate max-w-[200px]">
                        {item.vendorNamePreview || 'Unknown Supplier'}
                      </span>
                      {item.invoiceNumberPreview && (
                        <span className="text-[11px] text-muted-foreground">
                          (Inv #{item.invoiceNumberPreview})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>Total: <strong className="text-foreground">₹{(item.totalAmountPreview || 0).toFixed(2)}</strong></span>
                      <span>• {item.itemCount} items</span>
                      {item.flaggedCount > 0 ? (
                        <span className="text-amber-600 font-semibold">• {item.flaggedCount} flagged</span>
                      ) : (
                        <span className="text-emerald-600 font-semibold">• All verified</span>
                      )}
                    </div>
                  </div>
                ) : item.status === 'FAILED' ? (
                  <div className="text-xs text-red-600 bg-red-50 dark:bg-red-950/50 p-2 rounded border border-red-200">
                    <strong>Failed:</strong> {item.errorMessage}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    {item.status === 'PROCESSING' ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                        <span className="text-blue-700 font-medium">Extracting products and prices...</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span>Waiting in queue to process...</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Right Column: Status Badge & Actions */}
              <div className="flex items-center gap-2">
                {/* Status Badges */}
                {item.status === 'READY' && (
                  <span className="px-2.5 py-1 text-xs font-bold text-emerald-800 bg-emerald-100 rounded-md flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Ready
                  </span>
                )}
                {item.status === 'PROCESSING' && (
                  <span className="px-2.5 py-1 text-xs font-bold text-blue-800 bg-blue-100 rounded-md flex items-center gap-1 animate-pulse">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Processing
                  </span>
                )}
                {item.status === 'PENDING' && (
                  <span className="px-2.5 py-1 text-xs font-medium text-amber-800 bg-amber-100 rounded-md">
                    Pending
                  </span>
                )}
                {item.status === 'FAILED' && (
                  <span className="px-2.5 py-1 text-xs font-bold text-red-800 bg-red-100 rounded-md">
                    Failed
                  </span>
                )}
                {item.status === 'APPROVED' && (
                  <span className="px-2.5 py-1 text-xs font-bold text-muted-foreground bg-muted rounded-md flex items-center gap-1">
                    <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Inwarded
                  </span>
                )}

                {/* Primary Action Button */}
                {item.status === 'READY' && (
                  <button
                    type="button"
                    disabled={openingItemId === item.id}
                    onClick={() => handleReviewItem(item)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-primary hover:bg-primary/90 rounded-md transition-all shadow-sm disabled:opacity-60 cursor-pointer"
                  >
                    {openingItemId === item.id ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Opening...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Review & Inward</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                )}

                {item.status === 'FAILED' && (
                  <button
                    type="button"
                    onClick={() => handleRetry(item.id)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-foreground bg-muted hover:bg-muted/80 rounded-md border"
                  >
                    <RotateCw className="w-3 h-3" />
                    <span>Retry</span>
                  </button>
                )}

                {/* Delete / Discard */}
                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  className="p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded hover:bg-muted"
                  title="Remove from queue"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
