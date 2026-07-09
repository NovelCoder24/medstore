export const version = 4
export const name = '004_purchase_net_rate'
export const sql = `
  -- Add net_rate_paise to purchase_items
  ALTER TABLE purchase_items ADD COLUMN net_rate_paise INTEGER NOT NULL DEFAULT 0;
`
