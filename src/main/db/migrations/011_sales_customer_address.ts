export const version = 11
export const name = 'sales_customer_address'

export const sql = `
  ALTER TABLE sales ADD COLUMN customer_address TEXT;
`
