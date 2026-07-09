export const version = 6
export const name = 'batches_indexes'

export const sql = `
-- Create an index on product_id for the batches table to ensure fast subqueries
CREATE INDEX IF NOT EXISTS idx_batches_product_id ON batches(product_id);
`;
