import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { GoogleGenAI, Type } from '@google/genai'
import * as fs from 'fs'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables (for GEMINI_API_KEY)
dotenv.config({ path: path.join(process.cwd(), '.env') })

// Use gemini-2.5-flash as the default model for OCR and multimodality
const MODEL_NAME = 'gemini-2.5-flash'

export interface OcrExtractionResult {
  invoiceNumber: string | null
  invoiceDate: string | null // YYYY-MM-DD
  vendorName: string | null
  totalAmount: number | null // in rupees, not paise
  items: {
    productName: string
    batchNumber: string
    expiryMonth: number
    expiryYear: number
    quantityPacks: number
    quantityLoose: number
    mrp: number // rupees
    purchaseRate: number // rupees
    discountPct: number
  }[]
}

/**
 * Extracts structured pharmacy invoice data from an image using Gemini.
 */
export async function extractInvoiceData(imagePath: string): Promise<OcrExtractionResult> {
  const apiKey = process.env.GEMINI_API_KEY
  
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set in the environment variables.')
  }

  const ai = new GoogleGenAI({ apiKey })

  // Read image and convert to base64
  const imageBytes = fs.readFileSync(imagePath)
  const base64Image = imageBytes.toString('base64')
  
  // Determine mime type (basic check)
  const ext = path.extname(imagePath).toLowerCase()
  let mimeType = 'image/jpeg'
  if (ext === '.png') mimeType = 'image/png'
  if (ext === '.webp') mimeType = 'image/webp'
  if (ext === '.pdf') mimeType = 'application/pdf'

  const prompt = `
    You are an expert OCR assistant for an Indian retail pharmacy.
    Extract the invoice details from the provided image of a wholesaler bill.
    Map the data exactly to the requested JSON schema.
    
    Rules:
    - If a field is not found or unreadable, return null or 0.
    - Dates must be converted to standard formats.
    - For Expiry, usually formatted as MM/YY or MM/YYYY. Convert to integer Month and Year.
    - If the year is YY (e.g., 25), convert to YYYY (2025).
    - If the product name has pack size attached (e.g. "Dolo 650 15s"), keep it in the productName.
    - mrp and purchaseRate must be numbers representing Rupees (e.g. 55.50). Do not use strings.
    - discountPct is the percentage discount on the item (e.g. 10.5).
  `

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          {
            inlineData: {
              data: base64Image,
              mimeType: mimeType
            }
          }
        ]
      }
    ],
    config: {
      temperature: 0.1, // Low temp for more deterministic extraction
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          invoiceNumber: { type: Type.STRING, nullable: true },
          invoiceDate: { type: Type.STRING, description: "Format: YYYY-MM-DD", nullable: true },
          vendorName: { type: Type.STRING, nullable: true },
          totalAmount: { type: Type.NUMBER, description: "Total bill amount in Rupees", nullable: true },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                productName: { type: Type.STRING },
                batchNumber: { type: Type.STRING },
                expiryMonth: { type: Type.INTEGER },
                expiryYear: { type: Type.INTEGER },
                quantityPacks: { type: Type.INTEGER },
                quantityLoose: { type: Type.INTEGER },
                mrp: { type: Type.NUMBER, description: "MRP in Rupees" },
                purchaseRate: { type: Type.NUMBER, description: "Purchase Rate in Rupees" },
                discountPct: { type: Type.NUMBER }
              },
              required: ["productName", "batchNumber", "expiryMonth", "expiryYear", "quantityPacks", "quantityLoose", "mrp", "purchaseRate", "discountPct"]
            }
          }
        },
        required: ["items"]
      }
    }
  })

  const responseText = response.text
  
  if (!responseText) {
    throw new Error('Failed to extract data from image. Empty response.')
  }

  try {
    const result = JSON.parse(responseText) as OcrExtractionResult
    return result
  } catch (err) {
    throw new Error('Failed to parse AI response as JSON.')
  }
}

export function registerOcrHandlers() {
  ipcMain.handle(IPC_CHANNELS.OCR_EXTRACT, async (_, imagePath: string) => {
    return await extractInvoiceData(imagePath)
  })
}
