/**
 * Migration 012 — Vendor Unique Constraints
 *
 * Ensures no duplicate suppliers can be created with the same name (case-insensitive)
 * or same GSTIN for active vendors.
 */
export const version = 12
export const name = 'vendor_unique_indexes'

export const sql = `
-- Clean up any existing duplicate active vendor names by keeping the lowest ID active
UPDATE vendors 
SET is_active = 0 
WHERE id NOT IN (
    SELECT MIN(id) 
    FROM vendors 
    WHERE is_active = 1 
    GROUP BY LOWER(TRIM(name))
) AND is_active = 1;

-- Clean up any duplicate non-empty GSTINs
UPDATE vendors 
SET gstin = NULL 
WHERE id NOT IN (
    SELECT MIN(id) 
    FROM vendors 
    WHERE gstin IS NOT NULL AND TRIM(gstin) != '' AND is_active = 1 
    GROUP BY UPPER(TRIM(gstin))
) AND gstin IS NOT NULL AND TRIM(gstin) != '' AND is_active = 1;

-- Unique index on case-insensitive vendor name for active vendors
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendors_name_unique
    ON vendors(LOWER(TRIM(name))) WHERE is_active = 1;

-- Unique index on GSTIN for active vendors (only when GSTIN is provided)
CREATE UNIQUE INDEX IF NOT EXISTS idx_vendors_gstin_unique
    ON vendors(UPPER(TRIM(gstin))) WHERE gstin IS NOT NULL AND TRIM(gstin) != '' AND is_active = 1;
`
