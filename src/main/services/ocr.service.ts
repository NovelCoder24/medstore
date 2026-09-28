import { ipcMain, app, nativeImage } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { GoogleGenAI, Type } from '@google/genai'
import * as fs from 'fs'
import * as path from 'path'
import { getSecretSetting, getSetting, setSetting } from './settings.service'
import { getVendorOcrProfile, buildVendorContextPromptBlock } from './vendor-ocr-profile.service'
import { z } from 'zod'
import crypto from 'crypto'
import type { OcrExtractionResult, OcrExtractedItem, DailyOcrUsage } from '../../shared/types'

// Model Hierarchy:
// 1. Primary: gemini-3.8-flash (default & fastest)
// 2. Optional: gemini-3.7-flash (selectable in Settings)
// 3. 1st Fallback: gemini-3.6-flash
// 4. 2nd Fallback: gemini-3.5-flash
export const DEFAULT_PRIMARY_MODEL = 'gemini-3.8-flash'
export const FALLBACK_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash']

// Daily rate-limiting guardrails
export const DAILY_WARN_THRESHOLD = 40  // warn at 40 of ~50 estimated daily free requests
export const DAILY_HARD_LIMIT = 55      // hard stop to prevent account-level throttling

export function getDailyOcrUsage(): DailyOcrUsage {
  const today = new Date().toISOString().slice(0, 10)
  const countKey = `OCR_COUNT_${today}`
  const count = parseInt(getSetting(countKey) || '0', 10)
  return {
    count,
    limit: DAILY_HARD_LIMIT,
    warnThreshold: DAILY_WARN_THRESHOLD,
    isApproachingLimit: count >= DAILY_WARN_THRESHOLD,
    isAtLimit: count >= DAILY_HARD_LIMIT
  }
}

// ── Helpers ──
function normalizeDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null
  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr

  try {
    // Attempt standard JS Date parse (handles formats like "12 Aug 2023")
    const parsed = new Date(dateStr)
    if (!isNaN(parsed.getTime())) {
      // Return YYYY-MM-DD
      const year = parsed.getFullYear()
      const month = String(parsed.getMonth() + 1).padStart(2, '0')
      const day = String(parsed.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
  } catch (e) {
    // fallback
  }

  // Manual fallback for DD/MM/YY or DD-MM-YYYY (Common in India)
  const dmyMatch = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0')
    const month = dmyMatch[2].padStart(2, '0')
    let year = dmyMatch[3]
    if (year.length === 2) year = '20' + year
    if (year.length === 4) return `${year}-${month}-${day}`
  }

  return dateStr
}

// ── Zod Schemas for Validation ──
const OcrItemSchema = z.object({
  productName: z.string().nullable().default(null),
  compositionName: z.string().nullable().default(null),
  scheduleFlag: z.enum(['H', 'H1', 'X', 'NONE']).nullable().default('NONE'),
  packText: z.string().nullable().default(null),
  batchNumber: z.string().nullable().default(null),
  expiryMonth: z.number().nullable().default(null),
  expiryYear: z.number().nullable().default(null),
  quantityPacks: z.number().nullable().default(0),
  quantityLoose: z.number().nullable().default(0),
  freeQuantity: z.number().nullable().optional(),
  mrp: z.number().nullable().default(0),
  purchaseRate: z.number().nullable().default(0),
  discountPct: z.number().nullable().default(0),
  gstRatePct: z.number().nullable().default(0),
  hsnCode: z.string().nullable().default(null),
  confidence: z.number().nullable().default(1.0),
  imageClarityReason: z.string().nullable().default(null),
  netRateRupees: z.number().nullable().default(null),
  lineAmountRupees: z.number().nullable().default(null)
})

const OcrExtractionSchema = z.object({
  invoiceNumber: z.string().nullable().default(null),
  invoiceDate: z.string().nullable().default(null),
  vendorName: z.string().nullable().default(null),
  vendorGstin: z.string().nullable().default(null),
  vendorPhone: z.string().nullable().default(null),
  vendorEmail: z.string().nullable().default(null),
  vendorAddress: z.string().nullable().default(null),
  totalAmount: z.number().nullable().default(0),
  grandTotalRupees: z.number().nullable().default(null),
  totalSgstRupees: z.number().nullable().default(null),
  totalCgstRupees: z.number().nullable().default(null),
  items: z.array(OcrItemSchema)
})

/**
 * Save and compress binary buffer to the invoices archive directory.
 * High-res smartphone camera photos (5-8MB) are downscaled (max 2000px) and compressed
 * to JPEG 75% quality (~150KB-250KB), providing 95% disk savings with zero text readability loss.
 */
export function archiveInvoiceImage(buffer: ArrayBuffer | Uint8Array, mimeType: string): string {
  const userDataPath = app.getPath('userData')
  const invoicesDir = path.join(userDataPath, 'invoices')

  if (!fs.existsSync(invoicesDir)) {
    fs.mkdirSync(invoicesDir, { recursive: true })
  }

  const rawBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer as any)

  // Compress image if it is a JPEG/PNG/WebP image
  if (mimeType.startsWith('image/')) {
    try {
      const img = nativeImage.createFromBuffer(rawBuffer)
      if (!img.isEmpty()) {
        const size = img.getSize()
        let processed = img

        // If photo exceeds 1400px max dimension, downscale proportionally
        const MAX_DIM = 1400
        if (size.width > MAX_DIM || size.height > MAX_DIM) {
          if (size.width >= size.height) {
            processed = img.resize({ width: MAX_DIM })
          } else {
            processed = img.resize({ height: MAX_DIM })
          }
        }

        // Compress to JPEG 65% quality — sharp text readability on printed invoices with ~50% token reduction
        const compressedBuffer = processed.toJPEG(65)
        const filename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}.jpg`
        const filePath = path.join(invoicesDir, filename)

        fs.writeFileSync(filePath, compressedBuffer)
        console.log(`[OCR Storage] Compressed camera photo from ${Math.round(rawBuffer.length / 1024)}KB -> ${Math.round(compressedBuffer.length / 1024)}KB`)
        return filePath
      }
    } catch (err) {
      console.warn('[OCR Storage] Failed image compression, saving raw file fallback:', err)
    }
  }

  // Fallback for PDFs or unparseable image buffers
  const ext = mimeType === 'application/pdf' ? '.pdf' : mimeType === 'image/png' ? '.png' : mimeType === 'image/webp' ? '.webp' : '.jpg'
  const filename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`
  const filePath = path.join(invoicesDir, filename)

  fs.writeFileSync(filePath, rawBuffer)
  return filePath
}

// Module-level constant — byte-identical across every invoice call to enable Gemini prefix/system caching
const SYSTEM_INSTRUCTION = `You are an OCR assistant for Indian pharmacy wholesaler invoices. Fill the JSON schema exactly.

VENDOR (page header):
- Seller = header company (e.g. "UNICARE"). The "M/s"/"To:" line is the BUYER — never vendorName.
- Extract vendorPhone, vendorEmail, vendorAddress from the header. invoiceDate strictly YYYY-MM-DD.

ITEMS:
- productName: Item Name/Particulars column only. Exclude distributor codes ("Com."/"Class"/"CND": "LEEFO", "8697").
- packText: exact Pack column text ("10'S", "1X15", "60GM"). Never merge pack into productName.
- quantityPacks: billed Qty. quantityLoose: free column ("Fr", "Free", "DISQTY").
- batchNumber: copy exactly; 5/S, 0/O, 8/B, 1/I are easily confused — inspect closely.
- Expiry "8/27" → expiryMonth=8, expiryYear=2027.
- "Rate" → purchaseRate; "N.Rate" → netRateRupees; single column → purchaseRate. Never round.
- grandTotalRupees: the GRAND TOTAL / NET AMT line — never miss it.
- compositionName: infer salts + strengths ("AUGMENTIN 625" → "Amoxicillin 500mg + Clavulanic Acid 125mg").
- scheduleFlag: "H", "H1", "X", or "NONE".

CONFIDENCE: any row field blurry/faint/cut off/ambiguous → confidence 0.50–0.75, imageClarityReason = max 5 words ("batch blurry"). Crisp row → 0.90–1.0, null.`

function isQuotaError(err: any): boolean {
  const msg = err?.message || ''
  const statusCode = err?.status || err?.httpStatusCode || err?.code
  return statusCode === 429 || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')
}

function isAuthError(err: any): boolean {
  const msg = err?.message || ''
  const statusCode = err?.status || err?.httpStatusCode || err?.code
  return (
    statusCode === 401 ||
    statusCode === 403 ||
    msg.includes('API_KEY_INVALID') ||
    msg.includes('PERMISSION_DENIED') ||
    msg.includes('API key not valid')
  )
}

function isModelNotFoundError(err: any): boolean {
  const msg = err?.message || ''
  const statusCode = err?.status || err?.httpStatusCode || err?.code
  return statusCode === 404 || msg.includes('404') || msg.includes('NOT_FOUND') || msg.includes('not found')
}

async function callGeminiOcr(
  ai: GoogleGenAI,
  modelName: string,
  userText: string,
  base64Image: string,
  mimeType: string,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<{ parsedResult: z.infer<typeof OcrExtractionSchema>; rawJsonData: any }> {
  if (signal?.aborted) {
    throw new Error('ABORTED')
  }

  let timeoutId: NodeJS.Timeout
  let abortHandler: (() => void) | undefined

  const abortOrTimeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`TIMEOUT_${timeoutMs}MS`)), timeoutMs)
    if (signal) {
      abortHandler = () => reject(new Error('ABORTED'))
      signal.addEventListener('abort', abortHandler, { once: true })
    }
  })

  const apiCall = ai.models.generateContent({
    model: modelName,
    contents: [
      {
        role: "user",
        parts: [
          { text: userText },
          { inlineData: { data: base64Image, mimeType: mimeType } }
        ]
      }
    ],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      ...( (modelName.includes('3.8') || modelName.includes('3.7') || modelName.includes('3.6') || modelName.includes('3.5') || modelName.includes('thinking'))
        ? { thinkingConfig: { thinkingBudget: 0 } }
        : {}
      ),
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          invoiceNumber: { type: Type.STRING, nullable: true },
          invoiceDate: { type: Type.STRING, nullable: true },
          vendorName: { type: Type.STRING, nullable: true },
          vendorGstin: { type: Type.STRING, nullable: true },
          vendorPhone: { type: Type.STRING, nullable: true },
          vendorEmail: { type: Type.STRING, nullable: true },
          vendorAddress: { type: Type.STRING, nullable: true },
          grandTotalRupees: { type: Type.NUMBER, nullable: true },
          totalSgstRupees: { type: Type.NUMBER, nullable: true },
          totalCgstRupees: { type: Type.NUMBER, nullable: true },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                productName: { type: Type.STRING, nullable: true },
                compositionName: { type: Type.STRING, nullable: true },
                scheduleFlag: { type: Type.STRING, enum: ["H", "H1", "X", "NONE"], nullable: true },
                packText: { type: Type.STRING, nullable: true },
                batchNumber: { type: Type.STRING, nullable: true },
                expiryMonth: { type: Type.INTEGER, nullable: true },
                expiryYear: { type: Type.INTEGER, nullable: true },
                quantityPacks: { type: Type.INTEGER, nullable: true },
                quantityLoose: { type: Type.INTEGER, nullable: true },
                mrp: { type: Type.NUMBER, nullable: true },
                purchaseRate: { type: Type.NUMBER, nullable: true },
                netRateRupees: { type: Type.NUMBER, nullable: true },
                discountPct: { type: Type.NUMBER, nullable: true },
                gstRatePct: { type: Type.NUMBER, nullable: true },
                hsnCode: { type: Type.STRING, nullable: true },
                confidence: { type: Type.NUMBER, nullable: true },
                imageClarityReason: { type: Type.STRING, nullable: true },
                lineAmountRupees: { type: Type.NUMBER, nullable: true },
              }
            }
          }
        },
        required: ["items", "vendorName", "invoiceNumber"]
      }
    }
  })

  const response: any = await Promise.race([apiCall, abortOrTimeoutPromise]).finally(() => {
    clearTimeout(timeoutId!)
    if (signal && abortHandler) {
      signal.removeEventListener('abort', abortHandler)
    }
  })

  const u = response?.usageMetadata
  if (u) {
    console.log(
      `[OCR] tokens (${modelName}): prompt=${u.promptTokenCount} ` +
      `(cached=${u.cachedContentTokenCount ?? 0}) ` +
      `thoughts=${u.thoughtsTokenCount ?? 0} ` +
      `output=${u.candidatesTokenCount} total=${u.totalTokenCount}`
    )
  }

  const responseText = response.text
  if (!responseText) throw new Error('Empty response from AI model')

  const rawData = JSON.parse(responseText)
  const parsed = OcrExtractionSchema.parse(rawData)

  return { parsedResult: parsed, rawJsonData: rawData }
}

/**
 * Extracts structured pharmacy invoice data from an image using Gemini.
 * @param vendorHint Optional context if the vendor is already known (e.g. re-scan from a dropdown)
 */
export async function extractInvoiceData(
  payload: { buffer: ArrayBuffer | Uint8Array; mimeType: string },
  vendorHint?: { vendorId?: number; gstin?: string; nameHint?: string },
  signal?: AbortSignal
): Promise<OcrExtractionResult> {
  if (signal?.aborted) {
    throw new Error('ABORTED')
  }

  const apiKey = getSecretSetting('GEMINI_API_KEY')

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set. Please configure it in settings.')
  }

  // Daily quota guardrail check
  const today = new Date().toISOString().slice(0, 10)
  const countKey = `OCR_COUNT_${today}`
  const todayCount = parseInt(getSetting(countKey) || '0', 10)

  if (todayCount >= DAILY_HARD_LIMIT) {
    throw new Error(`Daily AI quota limit reached (${todayCount}/${DAILY_HARD_LIMIT} requests today). Please use manual entry or try again tomorrow.`)
  }
  if (todayCount >= DAILY_WARN_THRESHOLD) {
    console.warn(`[OCR] Approaching daily limit: ${todayCount}/${DAILY_HARD_LIMIT} requests used today`)
  }

  // 1. Archive & compress original image to disk
  const archivedPath = archiveInvoiceImage(payload.buffer, payload.mimeType)

  if (signal?.aborted) {
    throw new Error('ABORTED')
  }

  // 2. Read compressed file (~100-250KB) instead of holding large 10MB raw buffer in memory
  const compressedBuffer = fs.readFileSync(archivedPath)
  const base64Image = compressedBuffer.toString('base64')
  const mimeType = archivedPath.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'

  // 3. Look up vendor OCR profile for context injection
  const vendorProfile = getVendorOcrProfile(vendorHint || {})
  const vendorContextBlock = buildVendorContextPromptBlock(vendorProfile)

  const ai = new GoogleGenAI({ apiKey })

  // User message text: inject dynamic vendor hints or default prompt instruction
  const userText = vendorContextBlock ? vendorContextBlock : 'Extract this pharmacy invoice.'

  // Determine user's preferred primary model, default to gemini-3.8-flash
  const primaryModel = getSetting('GEMINI_MODEL') || DEFAULT_PRIMARY_MODEL

  let extractionData: { parsedResult: z.infer<typeof OcrExtractionSchema>; rawJsonData: any } | null = null

  // ---------------------------------------------------------------------------
  // Model Hierarchy & Retry Policy:
  // 1. Primary Model: gemini-3.8-flash (or user-selected gemini-3.7-flash)
  //    - Up to 3 attempts with exponential backoff on 503/transient capacity crunches:
  //      * Attempt 1: Immediate call
  //      * Wait 2s + Jitter -> Retry 1 (Attempt 2)
  //      * Wait 4s + Jitter -> Retry 2 (Attempt 3)
  // 2. 1st Fallback: gemini-3.6-flash
  // 3. 2nd Fallback: gemini-3.5-flash
  // 4. Fail Fast: If quota (429) or auth fails -> fail fast immediately.
  //    If all fallbacks fail -> surface clear overload notice.
  // ---------------------------------------------------------------------------
  const PRIMARY_MAX_ATTEMPTS = 3
  const PRIMARY_TIMEOUT_MS = 25000
  const FALLBACK_TIMEOUT_MS = 45000

  for (let attempt = 1; attempt <= PRIMARY_MAX_ATTEMPTS; attempt++) {
    if (signal?.aborted) {
      throw new Error('ABORTED')
    }

    try {
      console.log(`[OCR] Primary model (${primaryModel}) - Attempt ${attempt}/${PRIMARY_MAX_ATTEMPTS}...`)
      extractionData = await callGeminiOcr(ai, primaryModel, userText, base64Image, mimeType, PRIMARY_TIMEOUT_MS, signal)
      console.log(`[OCR] Primary model (${primaryModel}) succeeded on attempt ${attempt}`)
      break
    } catch (err: any) {
      if (err?.message === 'ABORTED' || signal?.aborted) {
        throw new Error('ABORTED')
      }

      console.warn(`[OCR] Primary model (${primaryModel}) attempt ${attempt} failed: ${err.message}`)

      // Quota exhausted (429) & Auth errors cannot be fixed by retrying or falling back — fail fast immediately
      if (isQuotaError(err)) {
        console.warn('[OCR] Quota exhausted (429 RESOURCE_EXHAUSTED) — failing fast')
        throw new Error('Gemini API quota/rate limit reached (429 RESOURCE_EXHAUSTED). Please wait a moment or try again later.')
      }
      if (isAuthError(err)) {
        console.warn('[OCR] API Key invalid or permission denied — failing fast')
        throw new Error('Invalid Gemini API Key or permission denied. Please verify your API Key in Settings.')
      }

      // If model is not found / 404, don't waste 6 seconds retrying the same invalid model — break immediately to fallbacks
      if (isModelNotFoundError(err)) {
        console.warn(`[OCR] Primary model ${primaryModel} not available (404/NOT_FOUND). Proceeding immediately to fallback tier.`)
        break
      }

      // If attempts remain, back off on the same model (transient 503 spikes clear within 2 to 4 seconds)
      if (attempt < PRIMARY_MAX_ATTEMPTS) {
        const baseDelayMs = attempt === 1 ? 2000 : 4000
        const jitterMs = Math.floor(Math.random() * (attempt === 1 ? 500 : 1000))
        const totalDelayMs = baseDelayMs + jitterMs

        console.log(`[OCR] Transient error on primary model. Backing off ${totalDelayMs}ms (${baseDelayMs / 1000}s + jitter) before Retry ${attempt}...`)
        await new Promise(resolve => setTimeout(resolve, totalDelayMs))
      }
    }
  }

  // Fallback tiers: 1st fallback (gemini-3.6-flash), then 2nd fallback (gemini-3.5-flash)
  if (!extractionData) {
    const candidateFallbacks = FALLBACK_MODELS.filter(m => m !== primaryModel)

    for (let i = 0; i < candidateFallbacks.length; i++) {
      if (signal?.aborted) {
        throw new Error('ABORTED')
      }

      const fallbackModel = candidateFallbacks[i]
      const tierLabel = i === 0 ? '1st Fallback' : '2nd Fallback'
      console.log(`[OCR] Invoking ${tierLabel} model (${fallbackModel})...`)

      try {
        extractionData = await callGeminiOcr(ai, fallbackModel, userText, base64Image, mimeType, FALLBACK_TIMEOUT_MS, signal)
        console.log(`[OCR] ${tierLabel} model (${fallbackModel}) succeeded!`)
        break
      } catch (fallbackErr: any) {
        if (fallbackErr?.message === 'ABORTED' || signal?.aborted) {
          throw new Error('ABORTED')
        }

        console.warn(`[OCR] ${tierLabel} model (${fallbackModel}) failed: ${fallbackErr.message}`)

        if (isQuotaError(fallbackErr)) {
          throw new Error('Gemini API quota/rate limit reached (429 RESOURCE_EXHAUSTED). Please wait a moment or try again later.')
        }
        if (isAuthError(fallbackErr)) {
          throw new Error('Invalid Gemini API Key or permission denied. Please verify your API Key in Settings.')
        }

        // If more fallbacks exist, continue to next fallback model
      }
    }
  }

  // If all models failed (primary and both fallbacks)
  if (!extractionData) {
    throw new Error('Google AI servers are temporarily overloaded. Please enter manually or try again in a minute.')
  }

  const { parsedResult, rawJsonData } = extractionData

  // Map to final types — values stay in RUPEES (no paise conversion here)
  const finalItems: OcrExtractedItem[] = parsedResult.items.map(item => {
    const confidence = item.confidence ?? 1.0
    const isFlagged = !item.productName || !item.batchNumber || !item.expiryMonth || !item.expiryYear || !item.mrp || !item.purchaseRate || confidence < 0.7

    return {
      productName: item.productName,
      compositionName: item.compositionName || null,
      scheduleFlag: item.scheduleFlag || 'NONE',
      batchNumber: item.batchNumber,
      packText: item.packText,
      expiryMonth: item.expiryMonth,
      expiryYear: item.expiryYear,
      quantityPacks: item.quantityPacks || 0,
      quantityLoose: item.quantityLoose || item.freeQuantity || 0,
      mrp: item.mrp || 0,
      purchaseRate: item.purchaseRate || item.netRateRupees || 0,
      netRateRupees: item.netRateRupees,
      lineAmountRupees: item.lineAmountRupees,
      discountPct: item.discountPct || 0,
      gstRatePct: item.gstRatePct || 0,
      hsnCode: item.hsnCode,
      confidence,
      isFlagged
    }
  })

  // Increment daily usage count upon successful extraction
  setSetting(countKey, String(todayCount + 1))

  return {
    invoiceNumber: parsedResult.invoiceNumber,
    invoiceDate: normalizeDate(parsedResult.invoiceDate),
    vendorName: parsedResult.vendorName,
    vendorGstin: parsedResult.vendorGstin,
    vendorPhone: parsedResult.vendorPhone || null,
    vendorEmail: parsedResult.vendorEmail || null,
    vendorAddress: parsedResult.vendorAddress || null,
    totalAmount: parsedResult.totalAmount || parsedResult.grandTotalRupees || 0,
    grandTotalRupees: parsedResult.grandTotalRupees,
    totalSgstRupees: parsedResult.totalSgstRupees,
    totalCgstRupees: parsedResult.totalCgstRupees,
    imagePath: archivedPath,
    items: finalItems,
    rawExtraction: rawJsonData,
    _meta: {
      dailyRequestCount: todayCount + 1,
      dailyLimit: DAILY_HARD_LIMIT,
      isApproachingLimit: todayCount + 1 >= DAILY_WARN_THRESHOLD
    }
  }
}

export function registerOcrHandlers() {
  ipcMain.handle(IPC_CHANNELS.OCR_GET_DAILY_USAGE, () => {
    return getDailyOcrUsage()
  })

  ipcMain.handle(IPC_CHANNELS.OCR_EXTRACT, async (_, payload: {
    buffer: ArrayBuffer | Uint8Array;
    mimeType: string;
    vendorHint?: { vendorId?: number; gstin?: string; nameHint?: string }
  }) => {
    return await extractInvoiceData(
      { buffer: payload.buffer, mimeType: payload.mimeType },
      payload.vendorHint
    )
  })
}
