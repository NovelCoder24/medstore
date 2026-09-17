export const version = 15
export const name = 'customer_notes'

export const sql = `
-- ─────────────────────────────────────────
-- Add notes column to customers (Khata/Patient directory)
-- Used for specific medicines, chronic prescriptions, and patient notes
-- ─────────────────────────────────────────
ALTER TABLE customers ADD COLUMN notes TEXT;
`
