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
  const [isDragging, setIsDragging] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadQueue = async () => {
    try {
      const [list, usage] = await Promise.all([
        window.api.invoke(IPC_CHANNELS.OCR_QUEUE_LIST),
        window.api.invoke(IPC_CHANNELS.OCR_GET_DAILY_USAGE).catch(() => null)
      ])
      const fetchedItems = list || []
      setItems(fetchedItems)
      if (usage) setDailyUsage(usage)

      // If no active items remain in queue, immediately clear progress banner
      const hasActive = fetchedItems.some((i: OcrQueueSummaryItem) => i.status === 'PROCESSING' || i.status === 'PENDING')
      if (!hasActive) {
        setProgressEvent(null)
      }
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
      if (progress.status === 'IDLE') {
        setProgressEvent(null)
      } else {
        setProgressEvent(progress)
      }
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

  const handleClipboardPasteClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      if (navigator.clipboard?.read) {
        const clipboardItems = await navigator.clipboard.read()
        const files: File[] = []
        for (const item of clipboardItems) {
          for (const type of item.types) {
            if (type.startsWith('image/') || type === 'application/pdf') {
              const blob = await item.getType(type)
              const ext = type === 'application/pdf' ? 'pdf' : (type.split('/')[1] || 'png')
              const file = new File([blob], `pasted_invoice_${Date.now()}.${ext}`, { type })
              files.push(file)
            }
          }
        }
        if (files.length > 0) {
          await handleFilesUpload(files)
          return
        }
      }
      toast.info('Press Ctrl+V anywhere to paste your copied invoice.')
    } catch {
      toast.info('Press Ctrl+V anywhere to paste your copied invoice.')
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
        // Optimistically remove from state so the item disappears immediately
        setItems(prev => {
          const updated = prev.filter(i => i.id !== id)
          const stillHasActive = updated.some(i => i.status === 'PROCESSING' || i.status === 'PENDING')
          if (!stillHasActive) {
            setProgressEvent(null)
          }
          return updated
        })
        await window.api.invoke(IPC_CHANNELS.OCR_QUEUE_DELETE, id)
        toast.success('Invoice removed from queue')
        await loadQueue()
      } catch (err: any) {
        console.error('Failed to delete item:', err)
        toast.error('Failed to delete item', { description: err?.message })
        await loadQueue()
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

  const readyItems = items.filter(i => i.status === 'READY')
  const readyCount = readyItems.length
  const processingCount = items.filter(i => i.status === 'PROCESSING').length
  const pendingCount = items.filter(i => i.status === 'PENDING').length
  const failedCount = items.filter(i => i.status === 'FAILED').length
  const approvedCount = items.filter(i => i.status === 'APPROVED').length

  const totalPendingValue = readyItems.reduce((acc, curr) => acc + (curr.totalAmountPreview || 0), 0)
  const isQueueActive = (processingCount > 0 || pendingCount > 0) && progressEvent !== null && progressEvent.status === 'PROCESSING'

  const filteredItems = items.filter(item => {
    if (statusFilter === 'ALL') return true
    if (statusFilter === 'READY') return item.status === 'READY'
    if (statusFilter === 'PROCESSING') return item.status === 'PROCESSING' || item.status === 'PENDING'
    if (statusFilter === 'APPROVED') return item.status === 'APPROVED'
    if (statusFilter === 'FAILED') return item.status === 'FAILED'
    return true
  })

  return (
    <div className="flex flex-col h-full bg-slate-50/60 p-6 space-y-5 overflow-y-auto">
      {/* ── REFINED UPLOAD & DROPZONE SECTION ── */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          setIsDragging(false)
          handleDrop(e)
        }}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('button, kbd, a, input')) return
          fileInputRef.current?.click()
        }}
        className={`group relative rounded-2xl border-2 border-dashed transition-all duration-300 py-8 px-6 text-center cursor-pointer select-none overflow-hidden ${
          isDragging
            ? 'border-blue-500 bg-blue-50/90 shadow-md ring-4 ring-blue-100 scale-[1.005]'
            : isUploading
            ? 'border-blue-400 bg-gradient-to-b from-blue-50/70 via-indigo-50/30 to-slate-50/70 shadow-md ring-4 ring-blue-100/50'
            : 'border-blue-200 hover:border-blue-400 bg-gradient-to-b from-blue-50/50 via-white to-slate-50/70 shadow-2xs hover:shadow-xs'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => e.target.files && handleFilesUpload(e.target.files)}
        />

        {/* Top Animated Laser Beam during Upload */}
        {isUploading && (
          <div className="absolute top-0 left-0 right-0 h-1 overflow-hidden bg-blue-200/60 z-20">
            <div className="w-full h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-600 animate-shimmer-slide" />
          </div>
        )}

        {/* Top Badges (Quota & Real-Time Pipeline Status) */}
        <div className="sm:absolute sm:top-4 sm:right-5 flex flex-wrap items-center justify-center sm:justify-end gap-2.5 mb-3 sm:mb-0 z-10">
          {isQueueActive && (
            <div className="h-8 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-xs font-bold inline-flex items-center gap-2 shadow-xs relative overflow-hidden">
              <div className="absolute inset-0 bg-white/15 animate-shimmer-slide pointer-events-none" />
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-80"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
              </span>
              <span className="relative z-10 flex items-center gap-1.5 font-mono">
                <span>AI Extracting {progressEvent?.currentIndex || 1} / {progressEvent?.totalCount || (pendingCount + processingCount)}</span>
              </span>
            </div>
          )}

          {dailyUsage && (
            <div className="h-8 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 inline-flex items-center gap-2 shadow-2xs">
              <span className="text-slate-500 font-medium">⚡ AI Scans:</span>
              <span className={`px-2 py-0.5 rounded-md font-mono font-bold text-xs ${
                dailyUsage.isAtLimit 
                  ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                  : dailyUsage.isApproachingLimit
                  ? 'bg-amber-100 text-amber-900 border border-amber-200'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              }`}>
                {dailyUsage.count} / {dailyUsage.limit}
              </span>
            </div>
          )}
        </div>

        {/* Center Dropzone Body */}
        <div className="flex flex-col items-center justify-center max-w-lg mx-auto relative z-10">
          {/* Upload Icon Container with Animated Pulse during Upload */}
          <div className="relative mb-3">
            {isUploading && (
              <div className="absolute -inset-2 rounded-2xl bg-blue-400/25 animate-pulse-ring pointer-events-none" />
            )}
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 relative z-10 ${
              isUploading
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-blue-100/90 text-blue-600 border border-blue-200/90 shadow-2xs group-hover:scale-105 group-hover:bg-blue-600 group-hover:text-white'
            }`}>
              {isUploading ? (
                <Loader2 className="w-6 h-6 animate-spin text-white" />
              ) : (
                <UploadCloud className="w-6 h-6 transition-transform group-hover:-translate-y-0.5" />
              )}
            </div>
          </div>

          {/* Prompt Title */}
          <h3 className="text-sm sm:text-base font-bold text-slate-800 tracking-tight transition-colors">
            {isUploading ? (
              <span className="text-blue-900 font-extrabold flex items-center justify-center gap-2">
                <span>Uploading and parsing invoices...</span>
              </span>
            ) : (
              'Drag & drop distributor invoices here, or click to browse'
            )}
          </h3>

          {/* Subtext */}
          <p className="text-xs text-slate-600 mt-1 mb-4">
            {isUploading ? (
              <span className="inline-flex items-center gap-1.5 text-blue-700 font-medium">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
                </span>
                Reading image buffers and enqueuing into AI extraction pipeline
              </span>
            ) : (
              'Supports multi-page PDFs, distributor tax invoices, photos & scans (PDF, JPEG, PNG)'
            )}
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                fileInputRef.current?.click()
              }}
              disabled={isUploading}
              className={`h-10 px-5 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all active:scale-95 disabled:opacity-75 cursor-pointer inline-flex items-center gap-2 ${
                isUploading
                  ? 'bg-blue-700 ring-2 ring-blue-400/50'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isUploading ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <UploadCloud className="w-4 h-4 text-blue-100" />
              )}
              <span>{isUploading ? 'Uploading Invoices...' : 'Upload Invoices (PDF / Image)'}</span>
            </button>

            <button
              type="button"
              onClick={handleClipboardPasteClick}
              disabled={isUploading}
              className="h-10 px-3.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold shadow-2xs inline-flex items-center gap-2 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              title="Paste an invoice photo directly from clipboard or WhatsApp Web"
            >
              <ClipboardPaste className="w-3.5 h-3.5 text-emerald-600" />
              <span>Paste from WhatsApp <kbd className="px-1.5 py-0.5 bg-white text-emerald-950 font-mono text-[10px] font-bold rounded border border-emerald-300">Ctrl+V</kbd></span>
            </button>
          </div>
        </div>
      </div>

      {/* Notices */}
      {uploadError && (
        <div className="p-3 text-xs font-bold text-rose-900 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between shadow-2xs">
          <span>⚠️ {uploadError}</span>
          <button onClick={() => setUploadError(null)} className="text-rose-950 underline font-black cursor-pointer">Dismiss</button>
        </div>
      )}

      {skippedNotice && (
        <div className="p-3 text-xs font-semibold text-amber-900 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between shadow-2xs">
          <span>ℹ️ {skippedNotice}</span>
          <button onClick={() => setSkippedNotice(null)} className="text-amber-950 underline font-black cursor-pointer">Dismiss</button>
        </div>
      )}

      {/* ── SCANNED INVOICES REVIEW HEADER ── */}
      <div className="flex flex-col space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                Scanned Invoices
              </h3>
              {readyCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-500/15 text-emerald-800 border border-emerald-300 font-mono shadow-2xs">
                  {readyCount} Ready to Inward
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {totalPendingValue > 0 ? (
                <>
                  <span className="font-extrabold text-emerald-700 font-mono tabular-nums">
                    ₹{totalPendingValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </span>
                  {' '}total distributor stock ready to commit into inventory.
                </>
              ) : (
                'Review extracted medicine batches and commit them to stock ledger.'
              )}
            </p>
          </div>

          {/* Modern Segmented Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
            <button
              onClick={() => setStatusFilter('READY')}
              className={`h-8 px-3.5 rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                statusFilter === 'READY'
                  ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-500/30'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              <span>Ready</span>
              <span className={`px-1.5 py-0.2 rounded-md font-mono text-[10px] ${statusFilter === 'READY' ? 'bg-emerald-700 text-white' : 'bg-emerald-200/60 text-emerald-900'}`}>
                {readyCount}
              </span>
            </button>
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`h-8 px-3.5 rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                statusFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span>All</span>
              <span className={`px-1.5 py-0.2 rounded-md font-mono text-[10px] ${statusFilter === 'ALL' ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-700'}`}>
                {items.length}
              </span>
            </button>
            {(processingCount > 0 || pendingCount > 0) && (
              <button
                onClick={() => setStatusFilter('PROCESSING')}
                className={`h-8 px-3.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                  statusFilter === 'PROCESSING'
                    ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-500/30'
                    : 'bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100'
                }`}
              >
                <Loader2 className="w-3 h-3 animate-spin text-current" />
                <span>Processing ({processingCount + pendingCount})</span>
              </button>
            )}
            {approvedCount > 0 && (
              <button
                onClick={() => setStatusFilter('APPROVED')}
                className={`h-8 px-3.5 rounded-xl transition-all cursor-pointer ${
                  statusFilter === 'APPROVED'
                    ? 'bg-slate-700 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Inwarded ({approvedCount})
              </button>
            )}
            {failedCount > 0 && (
              <button
                onClick={() => setStatusFilter('FAILED')}
                className={`h-8 px-3.5 rounded-xl transition-all cursor-pointer ${
                  statusFilter === 'FAILED'
                    ? 'bg-rose-600 text-white shadow-xs ring-2 ring-rose-500/30'
                    : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
                }`}
              >
                Failed ({failedCount})
              </button>
            )}

            {approvedCount > 0 && (
              <button
                type="button"
                onClick={handleClearCompleted}
                className="text-[11px] text-slate-400 hover:text-slate-700 ml-1 underline cursor-pointer font-medium"
              >
                Clear Inwarded
              </button>
            )}
          </div>
        </div>

        {/* Refined Scanned Invoices List */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400 bg-white rounded-2xl border border-slate-200 shadow-2xs">
              <Loader2 className="w-7 h-7 animate-spin text-primary mb-2" />
              <span className="font-bold text-xs text-slate-700">Loading scanned invoices...</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-12 text-center text-slate-500 border border-slate-200 rounded-2xl bg-white shadow-2xs">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto mb-3 text-blue-600">
                <FileText className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">
                {statusFilter === 'READY' ? 'All Invoices Inwarded & Up to Date' : 'No invoices in this view'}
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                {statusFilter === 'READY'
                  ? 'There are no pending invoices waiting for inward review. Drop invoice PDFs or WhatsApp images above to scan distributor stock.'
                  : 'No invoices currently match the selected status filter.'}
              </p>
            </div>
          ) : (
            filteredItems.map(item => {
              const isPdf = item.fileName?.toLowerCase().endsWith('.pdf')
              const isReady = item.status === 'READY'

              return (
                <div
                  key={item.id}
                  className={`rounded-2xl border transition-all duration-300 p-4 shadow-2xs hover:shadow-xs relative overflow-hidden ${
                    isReady
                      ? 'bg-white hover:bg-emerald-50/15 border-emerald-200 hover:border-emerald-300 ring-1 ring-emerald-500/10'
                      : item.status === 'PROCESSING'
                      ? 'bg-gradient-to-r from-blue-50/60 via-white to-indigo-50/30 border-blue-400 ring-2 ring-blue-500/20 shadow-xs'
                      : item.status === 'PENDING'
                      ? 'bg-white border-blue-200/90 ring-1 ring-blue-500/10'
                      : item.status === 'FAILED'
                      ? 'bg-white border-rose-200 ring-1 ring-rose-500/10'
                      : 'bg-slate-50/70 border-slate-200 opacity-90'
                  }`}
                >
                  {/* Top Animated Laser Beam during active extraction */}
                  {item.status === 'PROCESSING' && (
                    <div className="absolute top-0 left-0 right-0 h-1 overflow-hidden bg-blue-100 z-10">
                      <div className="w-full h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-600 animate-shimmer-slide" />
                    </div>
                  )}

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Left: Document Pill & File Info */}
                    <div className="flex items-center gap-3.5 min-w-[240px]">
                      <div className={`px-2.5 py-1.5 rounded-xl border font-mono text-xs font-black shrink-0 shadow-2xs transition-all ${
                        isPdf 
                          ? 'bg-rose-50 text-rose-700 border-rose-200' 
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      } ${item.status === 'PROCESSING' ? 'ring-2 ring-blue-400/80 animate-pulse' : ''}`}>
                        {isPdf ? 'PDF' : 'IMG'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900 truncate max-w-[240px]" title={item.fileName}>
                            {item.fileName}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded font-semibold shrink-0">
                            #{item.id}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 font-mono">
                          {item.createdAt} • {(item.fileSizeBytes / 1024).toFixed(0)} KB
                        </p>
                      </div>
                    </div>

                    {/* Middle: Extracted Details & Verification */}
                    <div className="flex-1 min-w-[260px]">
                      {isReady || item.status === 'APPROVED' ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-extrabold text-slate-900 truncate max-w-[260px]" title={item.vendorNamePreview || 'Unknown Supplier'}>
                              {item.vendorNamePreview || <span className="text-slate-400 italic font-normal">Unknown Supplier</span>}
                            </span>
                            {item.invoiceNumberPreview && (
                              <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                Inv #{item.invoiceNumberPreview}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs">
                            <span>
                              Total:{' '}
                              <span className="text-emerald-700 font-bold text-xs mr-0.5">₹</span>
                              <strong className="text-slate-950 font-mono tabular-nums font-black text-base">
                                {(item.totalAmountPreview || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </strong>
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="text-slate-600 font-semibold">{item.itemCount} items</span>
                            <span className="text-slate-300">•</span>
                            {item.flaggedCount > 0 ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded-full">
                                <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                                {item.flaggedCount} flagged
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                All verified
                              </span>
                            )}
                          </div>
                        </div>
                      ) : item.status === 'FAILED' ? (
                        <div className="text-xs text-rose-800 bg-rose-50 p-2.5 rounded-xl border border-rose-200 font-medium">
                          <strong className="font-bold text-rose-950">Scan Error:</strong> {item.errorMessage}
                        </div>
                      ) : item.status === 'PROCESSING' ? (
                        <div className="text-xs text-blue-900 bg-blue-50/90 p-3 rounded-xl border border-blue-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 font-medium shadow-2xs relative overflow-hidden">
                          <div className="flex items-center gap-2.5">
                            <span className="relative flex h-2.5 w-2.5 shrink-0">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600"></span>
                            </span>
                            <div className="flex flex-col">
                              <span className="text-blue-950 font-extrabold flex items-center gap-1.5">
                                <span>Extracting items, batches & taxes with AI...</span>
                                <Sparkles className="w-3.5 h-3.5 text-indigo-600 animate-pulse" />
                              </span>
                              <span className="text-[11px] text-blue-700 font-normal">Gemini OCR vision pipeline reading bill items</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                            <div className="w-24 h-1.5 bg-blue-200/80 rounded-full overflow-hidden relative">
                              <div className="h-full w-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full animate-shimmer-slide" />
                            </div>
                            <span className="text-[10px] font-mono font-bold text-blue-900 uppercase tracking-wider">
                              Scanning
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-700 bg-slate-100/90 p-2.5 rounded-xl border border-slate-200/80 flex items-center justify-between gap-2 font-medium">
                          <div className="flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span className="text-slate-800 font-semibold">Queued for AI extraction</span>
                          </div>
                          <span className="text-[10px] font-mono font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                            Waiting
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                      {isReady && (
                        <button
                          type="button"
                          disabled={openingItemId === item.id}
                          onClick={() => handleReviewItem(item)}
                          className="h-9 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-60 whitespace-nowrap"
                        >
                          {openingItemId === item.id ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Opening Invoice...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5 text-blue-200" />
                              <span>Review & Inward</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </>
                          )}
                        </button>
                      )}

                      {item.status === 'PROCESSING' && (
                        <span className="h-9 px-3 text-xs font-bold text-blue-900 bg-blue-100/90 border border-blue-300 rounded-xl inline-flex items-center gap-1.5 shadow-2xs whitespace-nowrap animate-pulse">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-700" />
                          <span>Extracting...</span>
                        </span>
                      )}

                      {item.status === 'PENDING' && (
                        <span className="h-9 px-3 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          <span>Queued</span>
                        </span>
                      )}

                      {item.status === 'APPROVED' && (
                        <span className="h-9 px-3 text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 rounded-xl inline-flex items-center gap-1.5 shadow-2xs whitespace-nowrap">
                          <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                          Inwarded
                        </span>
                      )}

                      {item.status === 'FAILED' && (
                        <button
                          type="button"
                          onClick={() => handleRetry(item.id)}
                          className="h-9 px-3 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold shadow-2xs inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                        >
                          <RotateCw className="w-3 h-3 text-slate-600" />
                          <span>Retry</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="h-9 w-9 flex items-center justify-center text-slate-500 hover:text-rose-700 hover:bg-rose-100/70 rounded-xl transition cursor-pointer border border-transparent hover:border-rose-200 shrink-0"
                        title="Remove from queue"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}


