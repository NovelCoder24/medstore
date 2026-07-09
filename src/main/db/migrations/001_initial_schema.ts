/**
 * Migration 001 — Initial Schema
 *
 * Creates all core tables for MedStore POS.
 *
 * KEY DESIGN DECISIONS:
 * - All money columns are INTEGER (paise). No REAL/FLOAT for currency.
 * - All inventory quantities are in atomic units (individual pills/tablets).
 * - Barcode is NULLABLE — scanner is optional, FTS5 search is primary lookup.
 * - Partial unique index on barcode: unique only when non-null, allows multiple NULLs.
 * - Roles: OWNER (full admin), CASHIER (restricted).
 * - doctor_name/doctor_reg_no on sales: required when cart has H1/X schedule items.
 * - purchase_items tracks both quantity_packs (entered) and quantity_units (computed).
 * - audit_logs.override_by_user_id tracks manager override (cashier action + owner PIN).
 */
export const version = 1
export const name = 'initial_schema'

export const sql = `
-- ─────────────────────────────────────────
-- Users & Authentication
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    display_name    TEXT    NOT NULL,
    role            TEXT    NOT NULL CHECK(role IN ('OWNER', 'CASHIER')),
    hashed_pin      TEXT    NOT NULL,
    is_active       INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────
-- Vendors (Suppliers)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendors (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT    NOT NULL,
    gstin           TEXT,
    state_code      TEXT,
    contact_phone   TEXT,
    contact_email   TEXT,
    address         TEXT,
    ocr_profile_json TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────
-- Compositions (Salt + Strength + Dosage Form)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS compositions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    salt_name       TEXT    NOT NULL,
    strength        TEXT    NOT NULL,
    dosage_form     TEXT    NOT NULL,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(salt_name, strength, dosage_form)
);

-- ─────────────────────────────────────────
-- Products
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_name      TEXT    NOT NULL,
    generic_name    TEXT,
    manufacturer    TEXT,
    category        TEXT    NOT NULL CHECK(category IN ('ETHICAL', 'GENERIC', 'OTC', 'SURGICAL')) DEFAULT 'GENERIC',
    composition_id  INTEGER REFERENCES compositions(id),
    pack_size       INTEGER NOT NULL DEFAULT 1 CHECK(pack_size >= 1),
    barcode         TEXT,
    hsn_code        TEXT,
    gst_rate_pct    INTEGER NOT NULL DEFAULT 12,
    schedule_flag   TEXT    NOT NULL CHECK(schedule_flag IN ('H', 'H1', 'X', 'NONE')) DEFAULT 'NONE',
    shelf_rack      TEXT,
    is_active       INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Barcode: unique when present, multiple NULLs allowed (scanner is optional)
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode
    ON products(barcode) WHERE barcode IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_composition
    ON products(composition_id);

CREATE INDEX IF NOT EXISTS idx_products_category
    ON products(category);

-- ─────────────────────────────────────────
-- Batches (per-product, per-vendor stock lots)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS batches (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id          INTEGER NOT NULL REFERENCES products(id),
    vendor_id           INTEGER REFERENCES vendors(id),
    purchase_item_id    INTEGER,
    batch_number        TEXT    NOT NULL,
    expiry_date         TEXT    NOT NULL, -- Format: YYYY-MM-DD (use last day of month)
    quantity            INTEGER NOT NULL DEFAULT 0,
    mrp_paise           INTEGER NOT NULL,
    purchase_rate_paise INTEGER NOT NULL DEFAULT 0,
    gst_rate_pct        INTEGER NOT NULL DEFAULT 12,
    status              TEXT    NOT NULL CHECK(status IN ('ACTIVE', 'QUARANTINED', 'EXPIRED', 'RETURNED', 'DISPOSED')) DEFAULT 'ACTIVE',
    created_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_batches_product_status
    ON batches(product_id, status);

CREATE INDEX IF NOT EXISTS idx_batches_expiry
    ON batches(expiry_date);

CREATE INDEX IF NOT EXISTS idx_batches_vendor
    ON batches(vendor_id);

-- ─────────────────────────────────────────
-- Stock Movements (ledger)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_ledger (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id          INTEGER NOT NULL REFERENCES batches(id),
    movement_type     TEXT    NOT NULL CHECK(movement_type IN (
        'PURCHASE_IN', 'SALE_OUT', 'RETURN_IN', 'RETURN_OUT',
        'ADJUSTMENT', 'DISPOSAL', 'EXPIRY_BLOCK'
    )),
    quantity_delta    INTEGER NOT NULL,
    actor_user_id     INTEGER NOT NULL REFERENCES users(id),
    reason            TEXT,
    reference_entity  TEXT,
    created_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_batch
    ON stock_ledger(batch_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_actor
    ON stock_ledger(actor_user_id);

-- ─────────────────────────────────────────
-- Sales
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    bill_number     TEXT    NOT NULL UNIQUE,
    cashier_id      INTEGER NOT NULL REFERENCES users(id),
    payment_mode    TEXT    NOT NULL CHECK(payment_mode IN ('CASH', 'UPI', 'CARD', 'CREDIT')),
    subtotal_paise  INTEGER NOT NULL,
    discount_paise  INTEGER NOT NULL DEFAULT 0,
    cgst_paise      INTEGER NOT NULL DEFAULT 0,
    sgst_paise      INTEGER NOT NULL DEFAULT 0,
    igst_paise      INTEGER NOT NULL DEFAULT 0,
    total_paise     INTEGER NOT NULL,
    customer_mobile TEXT,
    customer_name   TEXT,
    doctor_name     TEXT,
    doctor_reg_no   TEXT,
    gst_type        TEXT    NOT NULL CHECK(gst_type IN ('INTRA', 'INTER')) DEFAULT 'INTRA',
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sales_cashier
    ON sales(cashier_id);

CREATE INDEX IF NOT EXISTS idx_sales_created
    ON sales(created_at);

-- ─────────────────────────────────────────
-- Sale Items
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sale_items (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id             INTEGER NOT NULL REFERENCES sales(id),
    product_id          INTEGER NOT NULL REFERENCES products(id),
    batch_id            INTEGER NOT NULL REFERENCES batches(id),
    quantity            INTEGER NOT NULL,
    unit_price_paise    INTEGER NOT NULL,
    discount_paise      INTEGER NOT NULL DEFAULT 0,
    taxable_value_paise INTEGER NOT NULL,
    cgst_paise          INTEGER NOT NULL DEFAULT 0,
    sgst_paise          INTEGER NOT NULL DEFAULT 0,
    igst_paise          INTEGER NOT NULL DEFAULT 0,
    total_paise         INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale
    ON sale_items(sale_id);

-- ─────────────────────────────────────────
-- Sales Returns
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales_returns (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    original_sale_id    INTEGER NOT NULL REFERENCES sales(id),
    return_number       TEXT    NOT NULL UNIQUE,
    processed_by        INTEGER NOT NULL REFERENCES users(id),
    reason              TEXT,
    refund_amount_paise INTEGER NOT NULL,
    created_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sales_return_items (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    return_id               INTEGER NOT NULL REFERENCES sales_returns(id),
    original_sale_item_id   INTEGER NOT NULL REFERENCES sale_items(id),
    batch_id                INTEGER NOT NULL REFERENCES batches(id),
    quantity                INTEGER NOT NULL,
    refund_paise            INTEGER NOT NULL
);

-- ─────────────────────────────────────────
-- Purchase Invoices
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_invoices (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_id           INTEGER NOT NULL REFERENCES vendors(id),
    invoice_number      TEXT    NOT NULL,
    invoice_date        TEXT,
    source              TEXT    NOT NULL CHECK(source IN ('MANUAL', 'OCR')) DEFAULT 'MANUAL',
    original_file_path  TEXT,
    verification_status TEXT    NOT NULL CHECK(verification_status IN ('PENDING', 'VERIFIED', 'REJECTED')) DEFAULT 'VERIFIED',
    verified_by         INTEGER REFERENCES users(id),
    total_amount_paise  INTEGER NOT NULL DEFAULT 0,
    created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(vendor_id, invoice_number)
);

-- ─────────────────────────────────────────
-- Purchase Items
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_items (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_invoice_id     INTEGER NOT NULL REFERENCES purchase_invoices(id),
    product_id              INTEGER NOT NULL REFERENCES products(id),
    batch_number            TEXT    NOT NULL,
    expiry_date             TEXT    NOT NULL,
    quantity_packs          INTEGER NOT NULL,
    quantity_units          INTEGER NOT NULL,
    mrp_paise               INTEGER NOT NULL,
    purchase_rate_paise     INTEGER NOT NULL,
    gst_rate_pct            INTEGER NOT NULL DEFAULT 12,
    total_paise             INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_purchase_items_invoice
    ON purchase_items(purchase_invoice_id);

-- ─────────────────────────────────────────
-- OCR Extractions
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ocr_extractions (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    purchase_invoice_id INTEGER REFERENCES purchase_invoices(id),
    source_file_path    TEXT    NOT NULL,
    vendor_id           INTEGER REFERENCES vendors(id),
    confidence_score    REAL,
    extracted_json      TEXT    NOT NULL,
    flagged_fields_json TEXT,
    status              TEXT    NOT NULL CHECK(status IN ('PENDING', 'ACCEPTED', 'REJECTED')) DEFAULT 'PENDING',
    created_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────
-- Expiry Alerts
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expiry_alerts (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id          INTEGER NOT NULL REFERENCES batches(id),
    days_to_expiry    INTEGER NOT NULL,
    severity          TEXT    NOT NULL CHECK(severity IN ('CRITICAL', 'WARNING', 'INFO')),
    assigned_user_id  INTEGER REFERENCES users(id),
    status            TEXT    NOT NULL CHECK(status IN ('OPEN', 'ACKNOWLEDGED', 'RESOLVED')) DEFAULT 'OPEN',
    created_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_expiry_alerts_batch
    ON expiry_alerts(batch_id);

CREATE INDEX IF NOT EXISTS idx_expiry_alerts_status
    ON expiry_alerts(status);

-- ─────────────────────────────────────────
-- Supplier Returns
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS supplier_returns (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_id         INTEGER NOT NULL REFERENCES vendors(id),
    challan_number    TEXT    UNIQUE,
    status            TEXT    NOT NULL CHECK(status IN ('DRAFT', 'SENT', 'CREDIT_RECEIVED')) DEFAULT 'DRAFT',
    total_value_paise INTEGER NOT NULL DEFAULT 0,
    created_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS supplier_return_items (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_return_id  INTEGER NOT NULL REFERENCES supplier_returns(id),
    batch_id            INTEGER NOT NULL REFERENCES batches(id),
    quantity            INTEGER NOT NULL,
    value_paise         INTEGER NOT NULL
);

-- ─────────────────────────────────────────
-- Audit Logs (append-only)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_user_id           INTEGER NOT NULL REFERENCES users(id),
    override_by_user_id     INTEGER REFERENCES users(id),
    action                  TEXT    NOT NULL,
    entity_type             TEXT    NOT NULL,
    entity_id               INTEGER,
    before_json             TEXT,
    after_json              TEXT,
    reason                  TEXT,
    created_at              TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
    ON audit_logs(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor
    ON audit_logs(actor_user_id);

-- ─────────────────────────────────────────
-- App Settings (key-value store)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_settings (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    key         TEXT    NOT NULL UNIQUE,
    value_json  TEXT    NOT NULL,
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────
-- Suspended Bills (hold + recall in POS)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suspended_bills (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    cashier_id      INTEGER NOT NULL REFERENCES users(id),
    cart_json       TEXT    NOT NULL,
    customer_name   TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);
`
