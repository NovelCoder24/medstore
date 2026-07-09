import { describe, it, expect } from 'vitest'
import { calculateItemGst, aggregateGst } from '../../src/shared/utils/gst'

describe('GST utility', () => {
  it('calculateItemGst computes tax correctly (intra-state)', () => {
    // ₹100 MRP, ₹10 discount, qty 2, 12% GST
    // Taxable = (100 - 10) * 2 = 180 (18000 paise)
    // Tax = 12% of 180 = 21.6 (2160 paise)
    // CGST = 10.8, SGST = 10.8
    const result = calculateItemGst(10000, 1000, 2, 12, false)
    
    expect(result.taxableValuePaise).toBe(18000)
    expect(result.cgstPaise).toBe(1080)
    expect(result.sgstPaise).toBe(1080)
    expect(result.igstPaise).toBe(0)
    expect(result.totalTaxPaise).toBe(2160)
    expect(result.lineTotalPaise).toBe(20160)
  })

  it('calculateItemGst computes tax correctly (inter-state)', () => {
    // Same as above but IGST only
    const result = calculateItemGst(10000, 1000, 2, 12, true)
    
    expect(result.taxableValuePaise).toBe(18000)
    expect(result.cgstPaise).toBe(0)
    expect(result.sgstPaise).toBe(0)
    expect(result.igstPaise).toBe(2160)
    expect(result.totalTaxPaise).toBe(2160)
    expect(result.lineTotalPaise).toBe(20160)
  })

  it('calculateItemGst handles rounding cleanly without 1-paise leaks', () => {
    // Taxable = 1555 paise
    // Tax 12% = 186.6 -> 187 paise
    // Intra-state split: CGST 93, SGST 94 (187 total)
    const result = calculateItemGst(1555, 0, 1, 12, false)
    
    expect(result.taxableValuePaise).toBe(1555)
    expect(result.totalTaxPaise).toBe(187)
    expect(result.cgstPaise).toBe(93) // floor(187/2)
    expect(result.sgstPaise).toBe(94) // 187 - 93
    expect(result.igstPaise).toBe(0)
    expect(result.lineTotalPaise).toBe(1742) // 1555 + 187
  })

  it('calculateItemGst throws if discount exceeds unit price', () => {
    expect(() => calculateItemGst(1000, 1500, 1, 12, false))
      .toThrow(/exceeds unit price/)
  })

  it('aggregateGst sums multiple lines correctly', () => {
    const lines = [
      calculateItemGst(10000, 0, 1, 12, false), // Taxable 10000, Tax 1200
      calculateItemGst(20000, 5000, 2, 18, false) // Taxable 30000, Tax 5400
    ]

    const total = aggregateGst(lines)
    
    expect(total.taxableValuePaise).toBe(40000)
    expect(total.totalTaxPaise).toBe(6600)
    expect(total.cgstPaise).toBe(600 + 2700)
    expect(total.sgstPaise).toBe(600 + 2700)
    expect(total.igstPaise).toBe(0)
    expect(total.lineTotalPaise).toBe(46600)
  })
})
