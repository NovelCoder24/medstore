/**
 * GST calculation utility.
 *
 * KEY RULE: GST is calculated AFTER item-level discount.
 *   Taxable Value = (Unit Price − Discount per unit) × Quantity
 *   GST = Taxable Value × Rate / 100
 *
 * Split:
 *   Intra-state → CGST (half) + SGST (half)
 *   Inter-state → IGST (full)
 *
 * All values are in integer paise.
 */

import type { Paise } from './paise'

export interface GstBreakdown {
  /** (unitPricePaise − discountPerUnitPaise) × quantity */
  taxableValuePaise: Paise
  /** Central GST — intra-state only */
  cgstPaise: Paise
  /** State GST — intra-state only */
  sgstPaise: Paise
  /** Integrated GST — inter-state only */
  igstPaise: Paise
  /** Total tax = cgst + sgst + igst */
  totalTaxPaise: Paise
  /** Grand total = taxableValue + totalTax */
  lineTotalPaise: Paise
}

/**
 * Calculate GST for a single sale line item.
 *
 * @param unitPricePaise   - MRP or selling price per atomic unit (paise)
 * @param discountPerUnitPaise - Discount per atomic unit (paise), applied before tax
 * @param quantity         - Number of atomic units sold
 * @param gstRatePct       - GST rate as integer percentage (e.g. 5, 12, 18, 28)
 * @param isInterState     - true if buyer state ≠ seller state
 *
 * @example
 *   // ₹100 item, ₹10 discount, qty 2, 12% GST, intra-state
 *   calculateItemGst(10000, 1000, 2, 12, false)
 *   // taxableValue: 18000, cgst: 1080, sgst: 1080, igst: 0, totalTax: 2160, lineTotal: 20160
 */
export function calculateItemGst(
  unitPricePaise: number,
  discountPerUnitPaise: number,
  quantity: number,
  gstRatePct: number,
  isInterState: boolean,
  isTaxInclusive: boolean = true
): GstBreakdown {
  const netPerUnit = unitPricePaise - discountPerUnitPaise
  if (netPerUnit < 0) {
    throw new Error(
      `Discount (${discountPerUnitPaise}) exceeds unit price (${unitPricePaise})`
    )
  }

  let taxableValuePaise: number
  let totalTaxPaise: number
  let lineTotalPaise: number

  if (isTaxInclusive) {
    // In India retail, MRP is inclusive of GST.
    lineTotalPaise = netPerUnit * quantity
    taxableValuePaise = Math.round((lineTotalPaise * 100) / (100 + gstRatePct))
    totalTaxPaise = lineTotalPaise - taxableValuePaise
  } else {
    // Tax exclusive: rate added on top of base taxable value
    taxableValuePaise = netPerUnit * quantity
    totalTaxPaise = Math.round((taxableValuePaise * gstRatePct) / 100)
    lineTotalPaise = taxableValuePaise + totalTaxPaise
  }

  // Split tax based on state boundary
  let cgstPaise: number
  let sgstPaise: number
  let igstPaise: number

  if (isInterState) {
    cgstPaise = 0
    sgstPaise = 0
    igstPaise = totalTaxPaise
  } else {
    // Even split; trunc + remainder avoids 1-paise skew on negative values (returns) (D5)
    cgstPaise = Math.trunc(totalTaxPaise / 2)
    sgstPaise = totalTaxPaise - cgstPaise
    igstPaise = 0
  }

  return {
    taxableValuePaise: taxableValuePaise as Paise,
    cgstPaise: cgstPaise as Paise,
    sgstPaise: sgstPaise as Paise,
    igstPaise: igstPaise as Paise,
    totalTaxPaise: totalTaxPaise as Paise,
    lineTotalPaise: lineTotalPaise as Paise
  }
}

/**
 * Aggregate multiple GstBreakdown line items into bill-level totals.
 */
export function aggregateGst(lines: GstBreakdown[]): Omit<GstBreakdown, 'lineTotalPaise'> & { lineTotalPaise: Paise } {
  let taxableValuePaise = 0
  let cgstPaise = 0
  let sgstPaise = 0
  let igstPaise = 0
  let totalTaxPaise = 0
  let lineTotalPaise = 0

  for (const line of lines) {
    taxableValuePaise += line.taxableValuePaise
    cgstPaise += line.cgstPaise
    sgstPaise += line.sgstPaise
    igstPaise += line.igstPaise
    totalTaxPaise += line.totalTaxPaise
    lineTotalPaise += line.lineTotalPaise
  }

  return {
    taxableValuePaise: taxableValuePaise as Paise,
    cgstPaise: cgstPaise as Paise,
    sgstPaise: sgstPaise as Paise,
    igstPaise: igstPaise as Paise,
    totalTaxPaise: totalTaxPaise as Paise,
    lineTotalPaise: lineTotalPaise as Paise
  }
}
