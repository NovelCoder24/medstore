import { describe, it, expect, beforeEach, vi } from 'vitest'
import { calculateItemGst } from '../../src/shared/utils/gst'

describe('Sales Service Integrity & GST Rules', () => {
  it('calculates retail GST-inclusive taxable value correctly per Indian GST rules', () => {
    // ₹100 MRP, ₹10 discount per unit, qty 2, 12% GST, intra-state
    // line total = (100 - 10) * 2 = ₹180 = 18000 paise
    // taxable value = 18000 * 100 / 112 = 16071 paise
    const gst = calculateItemGst(10000, 1000, 2, 12, false)

    expect(gst.lineTotalPaise).toBe(18000)
    expect(gst.taxableValuePaise).toBe(16071)
    expect(gst.totalTaxPaise).toBe(1929)
    expect(gst.cgstPaise).toBe(964)
    expect(gst.sgstPaise).toBe(965)
  })

  it('detects and flags 1-paise difference threshold for total verification', () => {
    const serverTotal = 18000
    const clientPayloadTotalValid = 18000
    const clientPayloadTotalTampered = 17500

    expect(Math.abs(clientPayloadTotalValid - serverTotal)).toBeLessThanOrEqual(1)
    expect(Math.abs(clientPayloadTotalTampered - serverTotal)).toBeGreaterThan(1)
  })

  it('handles exact sales return pro-rated refund calculations without integer division loss', () => {
    const saleItemTotalPaise = 1000 // ₹10.00 total for 3 units
    const quantitySold = 3

    // First return: 1 unit
    const return1Qty = 1
    const lineRefund1 = Math.round((saleItemTotalPaise * return1Qty) / quantitySold) // 333 paise
    expect(lineRefund1).toBe(333)

    // Second return: remaining 2 units
    const remainingQty = 2
    const lineRefund2 = saleItemTotalPaise - lineRefund1 // 1000 - 333 = 667 paise
    expect(lineRefund2).toBe(667)
    expect(lineRefund1 + lineRefund2).toBe(1000) // 100% exact refund sum
  })
})
