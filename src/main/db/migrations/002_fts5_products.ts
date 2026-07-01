/**
 * Migration 002 — FTS5 Full-Text Search for Products
 *
 * Creates a virtual FTS5 table for fast product search.
 * Barcode is included but handled as COALESCE(barcode, '') since barcode is optional.
 * Triggers keep the FTS index in sync with the products table automatically.
 */
export const version = 2
export const name = 'fts5_products'

export const sql = `
-- FTS5 virtual table — content-sync'd with products table
CREATE VIRTUAL TABLE IF NOT EXISTS products_fts USING fts5(
    brand_name,
    generic_name,
    manufacturer,
    barcode,
    composition_salt,
    content=products,
    content_rowid=id
);

-- ── Sync triggers ──

-- After INSERT on products → add to FTS
CREATE TRIGGER IF NOT EXISTS trg_products_fts_insert
AFTER INSERT ON products
BEGIN
    INSERT INTO products_fts(rowid, brand_name, generic_name, manufacturer, barcode, composition_salt)
    VALUES (
        new.id,
        new.brand_name,
        COALESCE(new.generic_name, ''),
        COALESCE(new.manufacturer, ''),
        COALESCE(new.barcode, ''),
        COALESCE(
            (SELECT salt_name FROM compositions WHERE id = new.composition_id),
            ''
        )
    );
END;

-- After UPDATE on products → remove old, add new
CREATE TRIGGER IF NOT EXISTS trg_products_fts_update
AFTER UPDATE ON products
BEGIN
    INSERT INTO products_fts(products_fts, rowid, brand_name, generic_name, manufacturer, barcode, composition_salt)
    VALUES (
        'delete',
        old.id,
        old.brand_name,
        COALESCE(old.generic_name, ''),
        COALESCE(old.manufacturer, ''),
        COALESCE(old.barcode, ''),
        COALESCE(
            (SELECT salt_name FROM compositions WHERE id = old.composition_id),
            ''
        )
    );
    INSERT INTO products_fts(rowid, brand_name, generic_name, manufacturer, barcode, composition_salt)
    VALUES (
        new.id,
        new.brand_name,
        COALESCE(new.generic_name, ''),
        COALESCE(new.manufacturer, ''),
        COALESCE(new.barcode, ''),
        COALESCE(
            (SELECT salt_name FROM compositions WHERE id = new.composition_id),
            ''
        )
    );
END;

-- After DELETE on products → remove from FTS
CREATE TRIGGER IF NOT EXISTS trg_products_fts_delete
AFTER DELETE ON products
BEGIN
    INSERT INTO products_fts(products_fts, rowid, brand_name, generic_name, manufacturer, barcode, composition_salt)
    VALUES (
        'delete',
        old.id,
        old.brand_name,
        COALESCE(old.generic_name, ''),
        COALESCE(old.manufacturer, ''),
        COALESCE(old.barcode, ''),
        COALESCE(
            (SELECT salt_name FROM compositions WHERE id = old.composition_id),
            ''
        )
    );
END;
`
