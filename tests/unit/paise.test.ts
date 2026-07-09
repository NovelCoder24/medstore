import { describe, it, expect } from 'vitest'
import {
  toPaise,
  toRupees,
  formatPaise,
  addPaise,
  subtractPaise,
  multiplyPaise,
  percentOfPaise,
  assertPaise,
  Paise
} from '../../src/shared/utils/paise'

describe('Paise utility', () => {
  it('toPaise converts rupees to paise', () => {
    expect(toPaise(152.50)).toBe(15250)
    expect(toPaise(152.5)).toBe(15250)
    expect(toPaise(10)).toBe(1000)
    expect(toPaise(0)).toBe(0)
  })

  it('toRupees converts paise to rupees', () => {
    expect(toRupees(15250 as Paise)).toBe(152.50)
    expect(toRupees(1000 as Paise)).toBe(10)
    expect(toRupees(0 as Paise)).toBe(0)
  })

  it('formatPaise formats display strings', () => {
    expect(formatPaise(15250 as Paise)).toBe('₹152.50')
    expect(formatPaise(15250 as Paise, false)).toBe('152.50')
    expect(formatPaise(1000 as Paise)).toBe('₹10.00')
    expect(formatPaise(0 as Paise)).toBe('₹0.00')
  })

  it('addPaise adds correctly', () => {
    expect(addPaise(1000 as Paise, 500 as Paise)).toBe(1500)
  })

  it('subtractPaise subtracts correctly', () => {
    expect(subtractPaise(1000 as Paise, 500 as Paise)).toBe(500)
    expect(subtractPaise(500 as Paise, 1000 as Paise)).toBe(-500)
  })

  it('multiplyPaise multiplies correctly', () => {
    expect(multiplyPaise(1500 as Paise, 3)).toBe(4500)
  })

  it('percentOfPaise calculates percentage with rounding', () => {
    expect(percentOfPaise(10000 as Paise, 12)).toBe(1200)
    // 12% of ₹15.55 (1555 paise) = 186.6 -> rounds to 187 paise
    expect(percentOfPaise(1555 as Paise, 12)).toBe(187)
  })

  it('assertPaise validates paise values', () => {
    expect(assertPaise(1000)).toBe(1000)
    expect(assertPaise(0)).toBe(0)
    
    expect(() => assertPaise(10.5)).toThrow(/must be an integer/)
    expect(() => assertPaise(-100)).toThrow(/must be non-negative/)
  })
})
