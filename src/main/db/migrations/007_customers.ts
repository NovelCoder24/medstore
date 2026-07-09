export const version = 7
export const name = 'customers'

export const sql = `
-- ─────────────────────────────────────────
-- Customers (Khata System)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    name                    TEXT    NOT NULL,
    mobile                  TEXT    NOT NULL UNIQUE,
    address                 TEXT,
    current_balance_paise   INTEGER NOT NULL DEFAULT 0,
    max_credit_limit_paise  INTEGER NOT NULL DEFAULT 500000, -- ₹5,000 default
    created_at              TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────
-- Customer Ledger
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_ledger (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id             INTEGER NOT NULL REFERENCES customers(id),
    transaction_type        TEXT    NOT NULL CHECK(transaction_type IN ('CREDIT_SALE', 'PAYMENT_RECEIVED', 'ADJUSTMENT')),
    amount_paise            INTEGER NOT NULL,
    reference_id            TEXT, -- e.g. Bill Number or Payment Receipt Number
    created_at              TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_customer_ledger_customer
    ON customer_ledger(customer_id);

-- ─────────────────────────────────────────
-- Modify Sales
-- ─────────────────────────────────────────
ALTER TABLE sales ADD COLUMN customer_id INTEGER REFERENCES customers(id);
`
