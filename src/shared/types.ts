/**
 * Shared types used by both main and renderer processes.
 *
 * Architecture rule: renderer NEVER imports from main/services/*.
 * All cross-process types live here.
 */

// ── OCR Extraction Types ──
// All monetary values are in RUPEES (float), exactly as Gemini returns them.
// Paise conversion happens at the OCR→store boundary in PurchaseForm.tsx,
// NOT inside ocr.service.ts. See DECISIONS.md.

export interface OcrExtractedItem {
  productName: string | null
  compositionName: string | null
  scheduleFlag: 'H' | 'H1' | 'X' | 'NONE' | null
  packText: string | null
  batchNumber: string | null
  expiryMonth: number | null
  expiryYear: number | null
  quantityPacks: number
  quantityLoose: number
  mrp: number         // rupees (float)
  purchaseRate: number // rupees (float)
  netRateRupees: number | null
  lineAmountRupees: number | null
  discountPct: number
  gstRatePct: number
  hsnCode: string | null
  confidence: number  // 0.0–1.0
  imageClarityReason?: string | null // e.g. "Blurry batch number", "Faint expiry date"
  isFlagged: boolean
  flagReasons?: string[]
  suggestedMatches?: Array<{ id: number; brandName: string; packSize: number }>
}

export interface OcrExtractionResult {
  invoiceNumber: string | null
  invoiceDate: string | null
  vendorName: string | null
  vendorGstin: string | null
  vendorPhone: string | null
  vendorEmail: string | null
  vendorAddress: string | null
  totalAmount: number    // rupees (float) - legacy / fallback
  grandTotalRupees: number | null
  totalSgstRupees: number | null
  totalCgstRupees: number | null
  imagePath: string
  items: OcrExtractedItem[]
  /** The raw Gemini JSON (pre-validation) for diff-based learning on approval */
  rawExtraction: Record<string, unknown>
  _meta?: {
    dailyRequestCount: number
    dailyLimit: number
    isApproachingLimit: boolean
  }
}

export interface DailyOcrUsage {
  count: number
  limit: number
  warnThreshold: number
  isApproachingLimit: boolean
  isAtLimit: boolean
}

// ── OCR Batch Queue Types ──
export type OcrQueueStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED' | 'APPROVED' | 'DISCARDED'

/** Lightweight queue summary item for high-performance IPC listing without large payload serialization */
export interface OcrQueueSummaryItem {
  id: number
  imageHash: string
  fileName: string
  filePath: string
  mimeType: string
  fileSizeBytes: number
  status: OcrQueueStatus
  errorMessage: string | null
  vendorNamePreview: string | null
  invoiceNumberPreview: string | null
  invoiceDatePreview: string | null
  totalAmountPreview: number | null
  itemCount: number
  flaggedCount: number
  retryCount: number
  processingDurationMs: number | null
  createdAt: string
  processedAt: string | null
  completedAt: string | null
}

/** Full queue item with deserialized extracted data — fetched on-demand per invoice */
export interface OcrQueueItem extends OcrQueueSummaryItem {
  extractedData: OcrExtractionResult | null
}

export interface OcrQueueProgressEvent {
  status: 'IDLE' | 'PROCESSING'
  currentItemId?: number
  currentFileName?: string
  currentIndex: number
  totalCount: number
  pendingCount: number
  estimatedSecondsRemaining: number
}

export interface OcrQueueUpdateEvent {
  type: 'ENQUEUED' | 'STATUS_CHANGED' | 'DELETED' | 'CLEARED'
  itemId?: number
  status?: OcrQueueStatus
  summary: {
    total: number
    pending: number
    processing: number
    ready: number
    failed: number
    approved: number
  }
}

// ── Vendor OCR Profile Types ──

export interface VendorOcrCorrection {
  field: string
  wrongValue: string
  correctedValue: string
  timestamp: string
}

export interface VendorOcrProfile {
  nameVariants: string[]
  layoutNotes: string
  correctionHistory: VendorOcrCorrection[]
}

