/**
 * Vendor OCR Profile Service — learning from owner corrections.
 *
 * Reads/writes a JSON blob in `vendors.ocr_profile_json` containing:
 * - Known name variants (to fix buyer/seller confusion)
 * - Layout notes (manual observations)
 * - A capped history (max 50) of past field-level corrections
 *
 * This module works exclusively in RUPEES (as Gemini returns them).
 * Paise conversion is NOT this module's responsibility.
 */

import { getDatabase } from './db.service'
import type { VendorOcrProfile, VendorOcrCorrection } from '../../shared/types'

const MAX_CORRECTION_HISTORY = 50

const EMPTY_PROFILE: VendorOcrProfile = {
  nameVariants: [],
  layoutNotes: '',
  correctionHistory: []
}

/**
 * Look up a vendor's OCR profile from the database.
 *
 * Lookup order:
 * 1. By vendorId (exact)
 * 2. By gstin (exact, case-insensitive)
 * 3. By nameHint (LIKE, best-effort)
 * 4. Returns empty default if nothing found
 */
export function getVendorOcrProfile(params: {
  vendorId?: number
  gstin?: string
  nameHint?: string
}): VendorOcrProfile & { resolvedVendorId: number | null } {
  const db = getDatabase()
  let row: { id: number; ocr_profile_json: string | null } | undefined

  if (params.vendorId) {
    row = db.prepare('SELECT id, ocr_profile_json FROM vendors WHERE id = ?')
      .get(params.vendorId) as typeof row
  }

  if (!row && params.gstin) {
    row = db.prepare('SELECT id, ocr_profile_json FROM vendors WHERE UPPER(gstin) = UPPER(?)')
      .get(params.gstin) as typeof row
  }

  if (!row && params.nameHint) {
    row = db.prepare('SELECT id, ocr_profile_json FROM vendors WHERE LOWER(name) LIKE LOWER(?)')
      .get(`%${params.nameHint}%`) as typeof row
  }

  if (!row) {
    return { ...EMPTY_PROFILE, resolvedVendorId: null }
  }

  try {
    const parsed = row.ocr_profile_json ? JSON.parse(row.ocr_profile_json) as VendorOcrProfile : EMPTY_PROFILE
    return {
      nameVariants: parsed.nameVariants || [],
      layoutNotes: parsed.layoutNotes || '',
      correctionHistory: parsed.correctionHistory || [],
      resolvedVendorId: row.id
    }
  } catch {
    console.warn(`[VendorOCR] Failed to parse ocr_profile_json for vendor ${row.id}, returning empty profile`)
    return { ...EMPTY_PROFILE, resolvedVendorId: row.id }
  }
}

/**
 * Save field-level corrections made by the owner during verification.
 *
 * No-ops when wrongValue === correctedValue (unchanged fields are skipped).
 * Caps history at MAX_CORRECTION_HISTORY (FIFO — oldest dropped).
 */
export function saveVendorOcrCorrection(
  vendorId: number,
  corrections: { field: string; wrongValue: string; correctedValue: string }[]
): void {
  // Filter out no-ops: skip fields where the value didn't actually change
  const realCorrections = corrections.filter(c => c.wrongValue !== c.correctedValue)
  if (realCorrections.length === 0) return

  const db = getDatabase()
  const row = db.prepare('SELECT ocr_profile_json FROM vendors WHERE id = ?')
    .get(vendorId) as { ocr_profile_json: string | null } | undefined

  if (!row) {
    console.warn(`[VendorOCR] Cannot save corrections: vendor ${vendorId} not found`)
    return
  }

  let profile: VendorOcrProfile
  try {
    profile = row.ocr_profile_json ? JSON.parse(row.ocr_profile_json) : { ...EMPTY_PROFILE }
  } catch {
    profile = { ...EMPTY_PROFILE }
  }

  // Ensure arrays exist
  profile.correctionHistory = profile.correctionHistory || []
  profile.nameVariants = profile.nameVariants || []

  const now = new Date().toISOString()

  for (const c of realCorrections) {
    const entry: VendorOcrCorrection = {
      field: c.field,
      wrongValue: c.wrongValue,
      correctedValue: c.correctedValue,
      timestamp: now
    }
    profile.correctionHistory.push(entry)

    // If the correction is a vendor name fix, add to nameVariants
    if (c.field === 'vendorName' && c.correctedValue && !profile.nameVariants.includes(c.correctedValue)) {
      profile.nameVariants.push(c.correctedValue)
    }
  }

  // Cap history: keep most recent MAX_CORRECTION_HISTORY entries
  if (profile.correctionHistory.length > MAX_CORRECTION_HISTORY) {
    profile.correctionHistory = profile.correctionHistory.slice(-MAX_CORRECTION_HISTORY)
  }

  db.prepare('UPDATE vendors SET ocr_profile_json = ? WHERE id = ?')
    .run(JSON.stringify(profile), vendorId)
}

/**
 * Build a prompt block to inject into the Gemini call when a vendor profile exists.
 * Returns empty string for blank/new profiles (no-op injection).
 */
export function buildVendorContextPromptBlock(profile: VendorOcrProfile & { resolvedVendorId: number | null }): string {
  const parts: string[] = []

  if (profile.nameVariants.length > 0) {
    parts.push(
      `VENDOR CONTEXT (from prior scans):`,
      `- Known vendor name(s): ${profile.nameVariants.join(', ')}`,
      `- If you see any of these names in the invoice header, use the most common/official version as vendorName.`
    )
  }

  if (profile.layoutNotes) {
    parts.push(`- Layout notes: ${profile.layoutNotes}`)
  }

  if (profile.correctionHistory.length > 0) {
    // Show the most recent corrections (last 10) as examples
    const recentCorrections = profile.correctionHistory.slice(-10)
    parts.push(`\nPAST CORRECTION EXAMPLES (learn from these — the owner corrected these fields in prior scans):`)
    for (const c of recentCorrections) {
      parts.push(`  - Field "${c.field}": model read "${c.wrongValue}" → owner corrected to "${c.correctedValue}"`)
    }
    parts.push(`Use these examples to avoid repeating the same misreads.`)
  }

  return parts.length > 0 ? parts.join('\n') : ''
}
