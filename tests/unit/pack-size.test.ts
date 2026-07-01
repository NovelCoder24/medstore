import { describe, it, expect } from 'vitest'
import { packsToUnits, unitsToDisplay, formatStock } from '../../src/main/utils/pack-size'

describe('Pack-size utility', () => {
  it('packsToUnits converts packs to atomic units', () => {
    expect(packsToUnits(10, 15)).toBe(150)
    expect(packsToUnits(0, 15)).toBe(0)
    expect(packsToUnits(5, 1)).toBe(5)
  })

  it('packsToUnits validates inputs', () => {
    expect(() => packsToUnits(-1, 15)).toThrow(/non-negative integer/)
    expect(() => packsToUnits(10, 0)).toThrow(/positive integer/)
    expect(() => packsToUnits(1.5, 15)).toThrow(/non-negative integer/)
  })

  it('unitsToDisplay converts units back to packs + loose', () => {
    expect(unitsToDisplay(37, 15)).toEqual({ packs: 2, loose: 7 })
    expect(unitsToDisplay(30, 15)).toEqual({ packs: 2, loose: 0 })
    expect(unitsToDisplay(7, 15)).toEqual({ packs: 0, loose: 7 })
    expect(unitsToDisplay(5, 1)).toEqual({ packs: 5, loose: 0 })
  })

  it('formatStock creates readable stock strings', () => {
    expect(formatStock(37, 15)).toBe('2 strips + 7 loose')
    expect(formatStock(30, 15)).toBe('2 strips')
    expect(formatStock(7, 15)).toBe('7 loose')
    expect(formatStock(5, 1)).toBe('5') // loose items sold individually just show number
    expect(formatStock(0, 15)).toBe('0')
    
    // Singular/plural check
    expect(formatStock(16, 15)).toBe('1 strip + 1 loose')
  })
})
