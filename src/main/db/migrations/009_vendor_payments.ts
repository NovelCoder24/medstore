export const version = 9
export const name = 'vendor_payments'

export const sql = `
-- ─────────────────────────────────────────
-- Vendor Balances & Instalment Payments
-- ─────────────────────────────────────────

-- 1. Ensure vendors table has current_balance_paise
-- SQLite doesn't error if we check column existence or handle gracefully
ALTER TABLE vendors ADD COLUMN current_balance_paise INTEGER NOT NULL DEFAULT 0;

-- 2. Vendor Payments (Instalments)
CREATE TABLE IF NOT EXISTS vendor_payments (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_id           INTEGER NOT NULL REFERENCES vendors(id),
    purchase_invoice_id INTEGER REFERENCES purchase_invoices(id),
    amount_paise        INTEGER NOT NULL,
    payment_mode        TEXT NOT NULL CHECK(payment_mode IN ('CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CREDIT')) DEFAULT 'CASH',
    reference_no        TEXT,
    notes               TEXT,
    recorded_by         INTEGER REFERENCES users(id),
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_vendor_payments_vendor
    ON vendor_payments(vendor_id);

-- 3. Vendor Ledger History
CREATE TABLE IF NOT EXISTS vendor_ledger (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_id           INTEGER NOT NULL REFERENCES vendors(id),
    transaction_type    TEXT NOT NULL CHECK(transaction_type IN ('PURCHASE_INVOICE', 'INSTALMENT_PAYMENT', 'SUPPLIER_RETURN', 'ADJUSTMENT')),
    amount_paise        INTEGER NOT NULL, -- Positive for bill addition, Negative for payment/return
    payment_mode        TEXT CHECK(payment_mode IN ('CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CREDIT')),
    reference_id        TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_vendor_ledger_vendor
    ON vendor_ledger(vendor_id);
`
