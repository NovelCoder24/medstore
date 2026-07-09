import { ipcMain, app } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { GoogleGenAI, Type } from '@google/genai'
import * as fs from 'fs'
import * as path from 'path'
import { getSecretSetting } from './settings.service'
import { getVendorOcrProfile, buildVendorContextPromptBlock } from './vendor-ocr-profile.service'
import { z } from 'zod'
import crypto from 'crypto'
import type { OcrExtractionResult, OcrExtractedItem } from '../../shared/types'

const MODEL_NAME = 'gemini-2.5-flash'

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
  totalAmount: z.number().nullable().default(0),
  grandTotalRupees: z.number().nullable().default(null),
  totalSgstRupees: z.number().nullable().default(null),
  totalCgstRupees: z.number().nullable().default(null),
  items: z.array(OcrItemSchema)
})

/**
 * Save the binary buffer to the invoices archive directory.
 */
function archiveInvoiceImage(buffer: ArrayBuffer | Uint8Array, mimeType: string): string {
  const userDataPath = app.getPath('userData')
  const invoicesDir = path.join(userDataPath, 'invoices')
  
  if (!fs.existsSync(invoicesDir)) {
    fs.mkdirSync(invoicesDir, { recursive: true })
  }

  const ext = mimeType === 'application/pdf' ? '.pdf' : mimeType === 'image/png' ? '.png' : mimeType === 'image/webp' ? '.webp' : '.jpg'
  const filename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`
  const filePath = path.join(invoicesDir, filename)
  
  fs.writeFileSync(filePath, Buffer.from(buffer as any))
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

  // 1. Archive original image
  const archivedPath = archiveInvoiceImage(payload.buffer, payload.mimeType)

  // 2. Look up vendor OCR profile for context injection
  const vendorProfile = getVendorOcrProfile(vendorHint || {})
  const vendorContextBlock = buildVendorContextPromptBlock(vendorProfile)

  const ai = new GoogleGenAI({ apiKey })
  const base64Image = Buffer.from(payload.buffer as any).toString('base64')
  const mimeType = payload.mimeType || 'image/jpeg'

  const prompt = `
    You are an expert OCR assistant for an Indian retail pharmacy wholesaler invoice.
    Extract every field into the exact JSON schema provided.

    VENDOR IDENTIFICATION (CRITICAL):
    - The vendor/seller is the company in the HEADER (top of page). 
    - Examples from training data: "UNICARE", "JAIN MEDICAL & SURGICAL", "SHREE RAM AGENCIES".
    - The "M/s" or "To:" line (e.g., "SHIV SHAKTI MEDICAL STORES") is the BUYER. NEVER extract the buyer as vendorName.
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

    PRODUCT NAMES (IGNORE DISTRIBUTOR SHORT-CODES):
    - DISTRIBUTOR CODES: Often, there is a column (labeled "Com.", "Class", or "CND") containing short uppercase codes (like "LEEFO", "8697") placed right next to the Item Name. DO NOT include these codes in the productName.
    - Extract productName from ONLY the actual Item Name/Particulars/Product column.

    CONFIDENCE SCORE (0.0 to 1.0):
    - Assess your certainty for each row. If the image is blurry, folded, or a batch number is ambiguous (like guessing between a 5 or an S), score it below 0.7. Do not default to 1.0 unless perfectly legible.
  `

  // 3. Inject vendor-specific context if profile exists
  const fullPrompt = vendorContextBlock
    ? prompt + '\n\n' + vendorContextBlock
    : prompt

  let response: any
  let attempt = 0
  const maxAttempts = 3
  
  while (attempt < maxAttempts) {
    try {
      let timeoutId: NodeJS.Timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('TIMEOUT_15S')), 15000)
      })

      const apiCall = ai.models.generateContent({
        model: MODEL_NAME,
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
              grandTotalRupees: { type: Type.NUMBER, nullable: true },
              totalSgstRupees: { type: Type.NUMBER, nullable: true },
              totalCgstRupees: { type: Type.NUMBER, nullable: true },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    productName: { type: Type.STRING, nullable: true },
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

      response = await Promise.race([apiCall, timeoutPromise]).finally(() => {
        clearTimeout(timeoutId!)
      })

      // If we got here, it succeeded, break out of loop
      break
    } catch (err: any) {
      attempt++
      if (err?.message === 'TIMEOUT_15S') {
        console.warn(`[OCR] Timeout on attempt ${attempt}`)
        // Do not retry on a 15-second timeout to avoid keeping the cashier waiting for 45+ seconds
        throw new Error('OCR Service timed out after 15 seconds. Please use manual entry.')
      }

      if (err?.status === 503 || err?.message?.includes('503') || err?.message?.includes('UNAVAILABLE') || attempt < maxAttempts) {
        console.warn(`[OCR] Gemini API error (attempt ${attempt}/${maxAttempts}): ${err.message}`)
        if (attempt >= maxAttempts) throw err
        // Wait 2 seconds before retrying
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt))
      } else {
        throw err
      }
    }
  }

  const responseText = response.text
  if (!responseText) throw new Error('Failed to extract data from image. Empty response.')

  // Commit (save) the exact raw result from Gemini 2.5 Flash for debugging
  console.log("=== RAW GEMINI 2.5 FLASH RESULT ===")
  console.log(responseText)
  console.log("===================================")
  fs.writeFileSync(`${archivedPath}.raw_response.json`, responseText)

  try {
    // 4. Parse JSON & Validate with Zod
    const rawData = JSON.parse(responseText)
    const validatedData = OcrExtractionSchema.parse(rawData)

    // 5. Map to final types — values stay in RUPEES (no paise conversion here)
    const finalItems: OcrExtractedItem[] = validatedData.items.map(item => {
      const confidence = item.confidence ?? 1.0
      const isFlagged = !item.productName || !item.batchNumber || !item.expiryMonth || !item.expiryYear || !item.mrp || !item.purchaseRate || confidence < 0.7

      return {
        productName: item.productName,
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
      invoiceNumber: validatedData.invoiceNumber,
      invoiceDate: normalizeDate(validatedData.invoiceDate),
      vendorName: validatedData.vendorName,
      vendorGstin: validatedData.vendorGstin,
      totalAmount: validatedData.totalAmount || validatedData.grandTotalRupees || 0,
      grandTotalRupees: validatedData.grandTotalRupees,
      totalSgstRupees: validatedData.totalSgstRupees,
      totalCgstRupees: validatedData.totalCgstRupees,
      imagePath: archivedPath,
      items: finalItems,
      rawExtraction: rawData
    }
  } catch (err: any) {
    console.error('OCR Parsing/Validation Error:', err)
    throw new Error('Failed to validate AI response shape: ' + err.message)
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
