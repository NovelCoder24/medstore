/**
 * Migration registry — import all migrations and export as sorted array.
 * The migration runner iterates this array in version order.
 *
 * To add a new migration:
 * 1. Create src/main/db/migrations/NNN_description.ts
 * 2. Import it here
 * 3. Add to the migrations array
 */

import * as m001 from './001_initial_schema'
/**
 * Migration registry — import all migrations and export as sorted array.
 * The migration runner iterates this array in version order.
 *
 * To add a new migration:
 * 1. Create src/main/db/migrations/NNN_description.ts
 * 2. Import it here
 * 3. Add to the migrations array
 */

import * as m001 from './001_initial_schema'
import * as m002 from './002_fts5_products'
import * as m003 from './003_settings'
import * as m004 from './004_purchase_net_rate'
import * as m005 from './005_fix_fts5'
import * as m006 from './006_batches_indexes'
import * as m007 from './007_customers'
import * as m008 from './008_audit_entity_name'
import * as m009 from './009_vendor_payments'

export interface Migration {
  version: number
  name: string
  sql: string
}



export const migrations: Migration[] = [
  m001,
  m002,
  m003,
  m004,
  m005,
  m006,
  m007,
  m008,
  m009
].sort(
  (a, b) => a.version - b.version
)
