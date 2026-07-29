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
  isFlagged: boolean
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
