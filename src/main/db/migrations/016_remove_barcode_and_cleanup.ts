export const version = 16
export const name = 'remove_barcode_and_cleanup'

export const sql = `
-- ============================================================================
-- Part 1: Remove barcode column and update FTS5 search index
-- ============================================================================

-- 1. Drop old triggers referencing barcode
DROP TRIGGER IF EXISTS trg_products_fts_insert;
DROP TRIGGER IF EXISTS trg_products_fts_update;
DROP TRIGGER IF EXISTS trg_products_fts_delete;

-- 2. Drop the old FTS table
DROP TABLE IF EXISTS products_fts;

-- 3. Drop index on barcode
DROP INDEX IF EXISTS idx_products_barcode;

-- 4. Drop the barcode column from products table
ALTER TABLE products DROP COLUMN barcode;

-- 5. Recreate FTS5 table without barcode
CREATE VIRTUAL TABLE products_fts USING fts5(
    brand_name,
    generic_name,
    manufacturer,
    composition_salt
);

-- 6. Repopulate FTS5 table
INSERT INTO products_fts(rowid, brand_name, generic_name, manufacturer, composition_salt)
SELECT 
    p.id, 
    p.brand_name, 
    COALESCE(p.generic_name, ''), 
    COALESCE(p.manufacturer, ''), 
    COALESCE(c.salt_name, '')
FROM products p
LEFT JOIN compositions c ON p.composition_id = c.id;

-- 7. Recreate FTS sync triggers without barcode
-- After INSERT
CREATE TRIGGER trg_products_fts_insert
AFTER INSERT ON products
BEGIN
    INSERT INTO products_fts(rowid, brand_name, generic_name, manufacturer, composition_salt)
    VALUES (
        new.id,
        new.brand_name,
        COALESCE(new.generic_name, ''),
        COALESCE(new.manufacturer, ''),
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
        composition_salt = COALESCE((SELECT salt_name FROM compositions WHERE id = new.composition_id), '')
    WHERE rowid = old.id;
END;

-- After DELETE
CREATE TRIGGER trg_products_fts_delete
AFTER DELETE ON products
BEGIN
    DELETE FROM products_fts WHERE rowid = old.id;
END;

-- ============================================================================
-- Part 2: Merge duplicate products and enforce unique constraint
-- ============================================================================

-- 8. Backfill metadata from duplicate products to canonical product if canonical has null
UPDATE products SET
  generic_name = COALESCE(products.generic_name, (
    SELECT p2.generic_name FROM products p2 
    WHERE UPPER(TRIM(p2.brand_name)) = UPPER(TRIM(products.brand_name)) 
      AND p2.pack_size = products.pack_size 
      AND p2.generic_name IS NOT NULL AND p2.generic_name != ''
    LIMIT 1
  )),
  manufacturer = COALESCE(products.manufacturer, (
    SELECT p2.manufacturer FROM products p2 
    WHERE UPPER(TRIM(p2.brand_name)) = UPPER(TRIM(products.brand_name)) 
      AND p2.pack_size = products.pack_size 
      AND p2.manufacturer IS NOT NULL AND p2.manufacturer != ''
    LIMIT 1
  )),
  composition_id = COALESCE(products.composition_id, (
    SELECT p2.composition_id FROM products p2 
    WHERE UPPER(TRIM(p2.brand_name)) = UPPER(TRIM(products.brand_name)) 
      AND p2.pack_size = products.pack_size 
      AND p2.composition_id IS NOT NULL
    LIMIT 1
  )),
  hsn_code = COALESCE(products.hsn_code, (
    SELECT p2.hsn_code FROM products p2 
    WHERE UPPER(TRIM(p2.brand_name)) = UPPER(TRIM(products.brand_name)) 
      AND p2.pack_size = products.pack_size 
      AND p2.hsn_code IS NOT NULL AND p2.hsn_code != ''
    LIMIT 1
  )),
  shelf_rack = COALESCE(products.shelf_rack, (
    SELECT p2.shelf_rack FROM products p2 
    WHERE UPPER(TRIM(p2.brand_name)) = UPPER(TRIM(products.brand_name)) 
      AND p2.pack_size = products.pack_size 
      AND p2.shelf_rack IS NOT NULL AND p2.shelf_rack != ''
    LIMIT 1
  ))
WHERE id IN (
  SELECT MIN(id) FROM products WHERE is_active = 1 GROUP BY UPPER(TRIM(brand_name)), pack_size HAVING COUNT(*) > 1
);

-- 9. Reassign batches from duplicate products to canonical product
UPDATE batches
SET product_id = (
    SELECT MIN(p.id)
    FROM products p
    JOIN products current_p ON current_p.id = batches.product_id
    WHERE UPPER(TRIM(p.brand_name)) = UPPER(TRIM(current_p.brand_name))
      AND p.pack_size = current_p.pack_size
      AND p.is_active = 1
)
WHERE product_id IN (
    SELECT p1.id FROM products p1
    WHERE p1.is_active = 1
      AND p1.id NOT IN (
        SELECT MIN(p2.id) FROM products p2 WHERE p2.is_active = 1 GROUP BY UPPER(TRIM(p2.brand_name)), p2.pack_size
      )
);

-- 10. Reassign sale_items from duplicate products to canonical product
UPDATE sale_items
SET product_id = (
    SELECT MIN(p.id)
    FROM products p
    JOIN products current_p ON current_p.id = sale_items.product_id
    WHERE UPPER(TRIM(p.brand_name)) = UPPER(TRIM(current_p.brand_name))
      AND p.pack_size = current_p.pack_size
      AND p.is_active = 1
)
WHERE product_id IN (
    SELECT p1.id FROM products p1
    WHERE p1.is_active = 1
      AND p1.id NOT IN (
        SELECT MIN(p2.id) FROM products p2 WHERE p2.is_active = 1 GROUP BY UPPER(TRIM(p2.brand_name)), p2.pack_size
      )
);

-- 11. Reassign purchase_items from duplicate products to canonical product
UPDATE purchase_items
SET product_id = (
    SELECT MIN(p.id)
    FROM products p
    JOIN products current_p ON current_p.id = purchase_items.product_id
    WHERE UPPER(TRIM(p.brand_name)) = UPPER(TRIM(current_p.brand_name))
      AND p.pack_size = current_p.pack_size
      AND p.is_active = 1
)
WHERE product_id IN (
    SELECT p1.id FROM products p1
    WHERE p1.is_active = 1
      AND p1.id NOT IN (
        SELECT MIN(p2.id) FROM products p2 WHERE p2.is_active = 1 GROUP BY UPPER(TRIM(p2.brand_name)), p2.pack_size
      )
);

-- 12. Delete duplicate product rows (triggers will automatically sync products_fts)
DELETE FROM products
WHERE is_active = 1
  AND id NOT IN (
    SELECT MIN(id) FROM products WHERE is_active = 1 GROUP BY UPPER(TRIM(brand_name)), pack_size
  );

-- 13. Add partial unique index on (UPPER(TRIM(brand_name)), pack_size) to permanently prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_brand_pack
ON products(UPPER(TRIM(brand_name)), pack_size)
WHERE is_active = 1;

-- ============================================================================
-- Part 3: Clean up disposed batches with no sales or return history
-- ============================================================================

-- 14. Remove all expiry alerts for disposed batches with no sales history
DELETE FROM expiry_alerts 
WHERE batch_id IN (
  SELECT b.id FROM batches b
  WHERE b.status = 'DISPOSED'
    AND NOT EXISTS (SELECT 1 FROM sale_items si WHERE si.batch_id = b.id)
    AND NOT EXISTS (SELECT 1 FROM sales_return_items sri WHERE sri.batch_id = b.id)
    AND NOT EXISTS (SELECT 1 FROM supplier_return_items sur WHERE sur.batch_id = b.id)
);

-- 15. Remove all stock ledger entries for disposed batches with no sales history
DELETE FROM stock_ledger 
WHERE batch_id IN (
  SELECT b.id FROM batches b
  WHERE b.status = 'DISPOSED'
    AND NOT EXISTS (SELECT 1 FROM sale_items si WHERE si.batch_id = b.id)
    AND NOT EXISTS (SELECT 1 FROM sales_return_items sri WHERE sri.batch_id = b.id)
    AND NOT EXISTS (SELECT 1 FROM supplier_return_items sur WHERE sur.batch_id = b.id)
);

-- 16. Permanently remove the disposed batches from batches table
DELETE FROM batches 
WHERE status = 'DISPOSED'
  AND NOT EXISTS (SELECT 1 FROM sale_items si WHERE si.batch_id = batches.id)
  AND NOT EXISTS (SELECT 1 FROM sales_return_items sri WHERE sri.batch_id = batches.id)
  AND NOT EXISTS (SELECT 1 FROM supplier_return_items sur WHERE sur.batch_id = batches.id);
`;
