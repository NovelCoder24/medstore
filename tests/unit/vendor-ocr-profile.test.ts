import { describe, it, expect, vi, beforeEach } from 'vitest'

// We need to mock the database for these tests
const mockGet = vi.fn()
const mockRun = vi.fn()
const mockPrepare = vi.fn(() => ({ get: mockGet, run: mockRun }))

vi.mock('../../src/main/services/db.service', () => ({
  getDatabase: () => ({
    prepare: mockPrepare
  })
}))

import { saveVendorOcrCorrection, getVendorOcrProfile, buildVendorContextPromptBlock } from '../../src/main/services/vendor-ocr-profile.service'
import type { VendorOcrProfile } from '../../src/shared/types'

describe('vendor-ocr-profile.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('saveVendorOcrCorrection', () => {
    it('no-ops when wrongValue === correctedValue', () => {
      saveVendorOcrCorrection(1, [
        { field: 'batchNumber', wrongValue: 'ABC123', correctedValue: 'ABC123' },
        { field: 'mrp', wrongValue: '50.00', correctedValue: '50.00' }
      ])

      // Should never even query the DB if all corrections are no-ops
      expect(mockPrepare).not.toHaveBeenCalled()
    })

    it('saves real corrections and skips no-ops', () => {
      mockGet.mockReturnValueOnce({
        ocr_profile_json: JSON.stringify({
          nameVariants: [],
          layoutNotes: '',
          correctionHistory: []
        })
      })

      saveVendorOcrCorrection(1, [
        { field: 'batchNumber', wrongValue: 'ABC123', correctedValue: 'ABC123' }, // no-op
        { field: 'mrp', wrongValue: '50.00', correctedValue: '55.50' }             // real change
      ])

      // Should have queried the DB (SELECT) and updated (UPDATE)
      expect(mockPrepare).toHaveBeenCalledTimes(2) // SELECT + UPDATE
      expect(mockRun).toHaveBeenCalledTimes(1)

      // Verify the saved JSON contains only the real correction
      const savedJson = JSON.parse(mockRun.mock.calls[0][0])
      expect(savedJson.correctionHistory).toHaveLength(1)
      expect(savedJson.correctionHistory[0].field).toBe('mrp')
      expect(savedJson.correctionHistory[0].wrongValue).toBe('50.00')
      expect(savedJson.correctionHistory[0].correctedValue).toBe('55.50')
    })

    it('caps correction history at 50 entries (FIFO)', () => {
      // Pre-fill with 49 entries
      const existingHistory = Array.from({ length: 49 }, (_, i) => ({
        field: `field_${i}`,
        wrongValue: `wrong_${i}`,
        correctedValue: `correct_${i}`,
        timestamp: '2026-01-01T00:00:00Z'
      }))

      mockGet.mockReturnValueOnce({
        ocr_profile_json: JSON.stringify({
          nameVariants: [],
          layoutNotes: '',
          correctionHistory: existingHistory
        })
      })

      // Add 3 new corrections → total would be 52, should be capped to 50
      saveVendorOcrCorrection(1, [
        { field: 'a', wrongValue: 'x', correctedValue: 'y' },
        { field: 'b', wrongValue: 'x', correctedValue: 'z' },
        { field: 'c', wrongValue: 'x', correctedValue: 'w' }
      ])

      const savedJson = JSON.parse(mockRun.mock.calls[0][0])
      expect(savedJson.correctionHistory).toHaveLength(50)
      // Oldest entries should have been dropped (FIFO)
      expect(savedJson.correctionHistory[0].field).toBe('field_2') // first two dropped
    })
  })

  describe('buildVendorContextPromptBlock', () => {
    it('returns empty string for blank/null profile', () => {
      const result = buildVendorContextPromptBlock({
        nameVariants: [],
        layoutNotes: '',
        correctionHistory: [],
        resolvedVendorId: null
      })

      expect(result).toBe('')
    })

    it('returns non-empty string when profile has name variants', () => {
      const result = buildVendorContextPromptBlock({
        nameVariants: ['ABC Pharma', 'ABC Pharmaceuticals'],
        layoutNotes: '',
        correctionHistory: [],
        resolvedVendorId: 1
      })

      expect(result).toContain('ABC Pharma')
      expect(result).toContain('ABC Pharmaceuticals')
      expect(result.length).toBeGreaterThan(0)
    })

    it('includes recent correction examples in prompt', () => {
      const result = buildVendorContextPromptBlock({
        nameVariants: [],
        layoutNotes: '',
        correctionHistory: [
          { field: 'batchNumber', wrongValue: '8T27', correctedValue: 'BT27', timestamp: '2026-01-01' }
        ],
        resolvedVendorId: 1
      })

      expect(result).toContain('8T27')
      expect(result).toContain('BT27')
      expect(result).toContain('CORRECTION')
    })
  })
})
