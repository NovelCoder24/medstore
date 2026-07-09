export const version = 5
export const name = 'fix_fts5'

export const sql = `
-- Drop old triggers
DROP TRIGGER IF EXISTS trg_products_fts_insert;
DROP TRIGGER IF EXISTS trg_products_fts_update;
DROP TRIGGER IF EXISTS trg_products_fts_delete;

-- Drop the old malformed FTS table
DROP TABLE IF EXISTS products_fts;

-- Recreate as a standard content-bearing FTS5 table (no content=products restriction)
CREATE VIRTUAL TABLE products_fts USING fts5(
    brand_name,
    generic_name,
    manufacturer,
    barcode,
    composition_salt
);

-- Re-populate existing products into the new FTS table
INSERT INTO products_fts(rowid, brand_name, generic_name, manufacturer, barcode, composition_salt)
SELECT 
    p.id, 
    p.brand_name, 
    COALESCE(p.generic_name, ''), 
    COALESCE(p.manufacturer, ''), 
    COALESCE(p.barcode, ''), 
    COALESCE(c.salt_name, '')
FROM products p
LEFT JOIN compositions c ON p.composition_id = c.id;

-- ── New Sync triggers (Standard SQL syntax) ──

-- After INSERT
CREATE TRIGGER trg_products_fts_insert
AFTER INSERT ON products
BEGIN
    INSERT INTO products_fts(rowid, brand_name, generic_name, manufacturer, barcode, composition_salt)
    VALUES (
        new.id,
        new.brand_name,
        COALESCE(new.generic_name, ''),
        COALESCE(new.manufacturer, ''),
        COALESCE(new.barcode, ''),
        COALESCE((SELECT salt_name FROM compositions WHERE id = new.composition_id), '')
    );
END;

-- After UPDATE
CREATE TRIGGER trg_products_fts_update
AFTER UPDATE ON products
BEGIN
    UPDATE products_fts SET 
        brand_name = new.brand_name,
        generic_name = COALESCE(new.generic_name, ''),
        manufacturer = COALESCE(new.manufacturer, ''),
        barcode = COALESCE(new.barcode, ''),
        composition_salt = COALESCE((SELECT salt_name FROM compositions WHERE id = new.composition_id), '')
    WHERE rowid = old.id;
END;

-- After DELETE
CREATE TRIGGER trg_products_fts_delete
AFTER DELETE ON products
BEGIN
    DELETE FROM products_fts WHERE rowid = old.id;
END;
`;
