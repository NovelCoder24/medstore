import { ipcMain, app, nativeImage } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { GoogleGenAI, Type } from '@google/genai'
import * as fs from 'fs'
import * as path from 'path'
import { getSecretSetting, getSetting } from './settings.service'
import { getVendorOcrProfile, buildVendorContextPromptBlock } from './vendor-ocr-profile.service'
import { z } from 'zod'
import crypto from 'crypto'
import type { OcrExtractionResult, OcrExtractedItem } from '../../shared/types'

// The fallback model to use if the user's selected model fails
const FALLBACK_MODEL = 'gemini-3.5-flash'

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
  mrp: z.number().nullable().default(0),
  purchaseRate: z.number().nullable().default(0),
  discountPct: z.number().nullable().default(0),
  gstRatePct: z.number().nullable().default(0),
  hsnCode: z.string().nullable().default(null),
  confidence: z.number().nullable().default(1.0),
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
function archiveInvoiceImage(buffer: ArrayBuffer | Uint8Array, mimeType: string): string {
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

        // If photo exceeds 2000px max dimension, downscale proportionally
        const MAX_DIM = 2000
        if (size.width > MAX_DIM || size.height > MAX_DIM) {
          if (size.width >= size.height) {
            processed = img.resize({ width: MAX_DIM })
          } else {
            processed = img.resize({ height: MAX_DIM })
          }
        }

        // Compress to JPEG 75% quality
        const compressedBuffer = processed.toJPEG(75)
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

/**
 * Extracts structured pharmacy invoice data from an image using Gemini.
 * @param vendorHint Optional context if the vendor is already known (e.g. re-scan from a dropdown)
 */
export async function extractInvoiceData(
  payload: { buffer: ArrayBuffer | Uint8Array; mimeType: string },
  vendorHint?: { vendorId?: number; gstin?: string; nameHint?: string }
): Promise<OcrExtractionResult> {
  const apiKey = getSecretSetting('GEMINI_API_KEY')

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set. Please configure it in settings.')
  }

  // 1. Archive & compress original image to disk
  const archivedPath = archiveInvoiceImage(payload.buffer, payload.mimeType)

  // 2. Read compressed file (~100-250KB) instead of holding large 10MB raw buffer in memory
  const compressedBuffer = fs.readFileSync(archivedPath)
  const base64Image = compressedBuffer.toString('base64')
  const mimeType = archivedPath.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'

  // 3. Look up vendor OCR profile for context injection
  const vendorProfile = getVendorOcrProfile(vendorHint || {})
  const vendorContextBlock = buildVendorContextPromptBlock(vendorProfile)

  const ai = new GoogleGenAI({ apiKey })

  const prompt = `
    You are an expert OCR assistant for an Indian retail pharmacy wholesaler invoice.
    Extract every field into the exact JSON schema provided.

    VENDOR IDENTIFICATION & CONTACT DETAILS (CRITICAL):
    - The vendor/seller is the company in the HEADER (top of page). 
    - Examples from training data: "UNICARE", "JAIN MEDICAL & SURGICAL", "SHREE RAM AGENCIES".
    - The "M/s" or "To:" line (e.g., "SHIV SHAKTI MEDICAL STORES") is the BUYER. NEVER extract the buyer as vendorName.
    - Extract vendor Phone Number into vendorPhone (e.g., "9826123456" or "0788-223456").
    - Extract vendor Email into vendorEmail if present.
    - Extract vendor Physical Address into vendorAddress if printed in header.
    - Format invoiceDate strictly as YYYY-MM-DD (e.g., 2023-10-24).

    PACKING & QUANTITIES (CRITICAL FOR INVENTORY MATH):
    - Look for a dedicated column named "Pack", "Packing", or similar. 
    - Extract EXACTLY what is printed into packText (Examples: "10'S", "1X15", "3ML", "60GM", "450ML"). Do NOT put the pack size into the productName if a dedicated Pack column exists.
    - quantityPacks is the main billed quantity (Usually under "Qty").
    - quantityLoose is for items given for free (Usually under "Fr", "Free", or "DISQTY").

    BATCH & EXPIRY:
    - Batch numbers are highly error-prone (e.g., distinguishing '5' vs 'S', '0' vs 'O'). Look closely.
    - Expiry (Exp): convert MM/YY to integer month and year. Example: "8/27" -> Month: 8, Year: 2027. "01/29" -> Month: 1, Year: 2029.

    PRICING & RATES (READ CAREFULLY):
    - "Rate" is the base price. Map this to purchaseRate.
    - "N.Rate" or "Net Rate" is the price after discount. Map this to netRateRupees.
    - If only one Rate column exists, map it to purchaseRate.
    - "totalAmount" MUST be the final Grand Total of the invoice (e.g., "GRAND TOTAL", "NET AMT."). Do not miss this.
    - Extract numbers exactly as printed (e.g., 89.06). Do not round.

    PRODUCT NAMES, COMPOSITION & SCHEDULE INFERENCE:
    - DISTRIBUTOR CODES: Often, there is a column (labeled "Com.", "Class", or "CND") containing short uppercase codes (like "LEEFO", "8697") placed right next to the Item Name. DO NOT include these codes in the productName.
    - Extract productName from ONLY the actual Item Name/Particulars/Product column.
    - COMPOSITION INFERENCE: Using your internal pharmaceutical knowledge, infer the active salt composition and strength for the product name (e.g., "ALCINAC-RB" -> "Aceclofenac 100mg + Rabeprazole 20mg", "AUGMENTIN 625" -> "Amoxicillin 500mg + Clavulanic Acid 125mg"). Set compositionName.
    - SCHEDULE INFERENCE: Infer the Indian Drug Schedule flag for this product ("H", "H1", "X", or "NONE"). Set scheduleFlag.

    CONFIDENCE SCORE (0.0 to 1.0):
    - Assess your certainty for each row. If the image is blurry, folded, or a batch number is ambiguous (like guessing between a 5 or an S), score it below 0.7. Do not default to 1.0 unless perfectly legible.
  `

  // 3. Inject vendor-specific context if profile exists
  const fullPrompt = vendorContextBlock
    ? prompt + '\n\n' + vendorContextBlock
    : prompt

  // Determine user's preferred model, default to fast gemini-3.7-flash
  const preferredModel = getSetting('GEMINI_MODEL') || 'gemini-3.7-flash'

  let parsedResult: z.infer<typeof OcrExtractionSchema> | null = null
  let rawJsonData: any = null
  let lastError: any = null

  // Models to try in order: user's preferred model first, then fallback
  const modelsToTry = [
    { model: preferredModel, timeoutMs: 20000, label: 'preferred' },
    { model: FALLBACK_MODEL, timeoutMs: 45000, label: `fallback (${FALLBACK_MODEL})` }
  ]

  // If user's preferred IS the fallback, don't try the same model twice
  if (preferredModel === FALLBACK_MODEL) {
    modelsToTry.splice(1, 1) // Remove the duplicate
  }

  for (let i = 0; i < modelsToTry.length; i++) {
    const { model: modelToUse, timeoutMs, label } = modelsToTry[i]
    console.log(`[OCR] Attempt ${i + 1}/${modelsToTry.length} using ${label} model: ${modelToUse} (timeout: ${timeoutMs / 1000}s)`)

    try {
      let timeoutId: NodeJS.Timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`TIMEOUT_${timeoutMs}MS`)), timeoutMs)
      })

      const apiCall = ai.models.generateContent({
        model: modelToUse,
        contents: [
          {
            role: "user",
            parts: [
              { text: fullPrompt },
              { inlineData: { data: base64Image, mimeType: mimeType } }
            ]
          }
        ],
        config: {
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
                    freeQuantity: { type: Type.INTEGER, nullable: true },
                    mrp: { type: Type.NUMBER, nullable: true },
                    purchaseRate: { type: Type.NUMBER, nullable: true },
                    netRateRupees: { type: Type.NUMBER, nullable: true },
                    discountPct: { type: Type.NUMBER, nullable: true },
                    gstRatePct: { type: Type.NUMBER, nullable: true },
                    hsnCode: { type: Type.STRING, nullable: true },
                    confidence: { type: Type.NUMBER, nullable: true },
                    lineAmountRupees: { type: Type.NUMBER, nullable: true },
                  }
                }
              }
            },
            required: ["items", "vendorName", "invoiceNumber"]
          }
        }
      })

      const response: any = await Promise.race([apiCall, timeoutPromise]).finally(() => {
        clearTimeout(timeoutId!)
      })

      const responseText = response.text
      if (!responseText) throw new Error('Empty response from AI model')

      // Validate JSON & Schema inside retry loop to trigger fallback on bad output (L3)
      const rawData = JSON.parse(responseText)
      parsedResult = OcrExtractionSchema.parse(rawData)
      rawJsonData = rawData

      // If we got here, API call and schema parsing both succeeded
      console.log(`[OCR] Success with ${label} model: ${modelToUse}`)
      lastError = null
      break
    } catch (err: any) {
      lastError = err
      const isTimeout = err?.message?.startsWith('TIMEOUT_')
      const reason = isTimeout ? 'timeout' : (err?.message || 'unknown error')
      console.warn(`[OCR] ${label} model (${modelToUse}) failed: ${reason}`)

      // If there's another model to try, wait briefly and continue the loop
      if (i < modelsToTry.length - 1) {
        console.log(`[OCR] Falling back to next model...`)
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
  }

  // If all models failed, throw the last error
  if (!parsedResult || lastError) {
    const isTimeout = lastError?.message?.startsWith('TIMEOUT_')
    if (isTimeout) {
      throw new Error('AI service is experiencing heavy traffic. All models timed out. Please try again in a moment or use manual entry.')
    }
    throw new Error('Failed to extract and validate AI response shape: ' + (lastError?.message || 'Unknown error'))
  }

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
      quantityLoose: item.quantityLoose || 0,
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
    rawExtraction: rawJsonData
  }
}

export function registerOcrHandlers() {
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
