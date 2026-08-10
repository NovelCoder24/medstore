/**
 * Migration 010 — Soft-Delete Enforcement
 *
 * Adds is_active column to vendors and batches tables for soft-delete support.
 * Products and users already have is_active. Under Section 65 of the Indian
 * Drugs and Cosmetics Rules, pharmacy software must retain complete records
 * (brand name, vendor name, cashier) for at least 3 years. Hard-deleting rows
 * destroys foreign-key relations and causes "Unknown Product / Unknown Vendor"
 * in historical reports. Soft-delete preserves 100% historical accuracy.
 */
export const version = 10
export const name = 'soft_delete_enforcement'

export const sql = `
-- Soft-delete support for vendors (products and users already have is_active)
ALTER TABLE vendors ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;

-- Soft-delete support for batches
ALTER TABLE batches ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;
`
