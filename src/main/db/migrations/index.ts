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

export interface Migration {
  version: number
  name: string
  sql: string
}

export const migrations: Migration[] = [m001, m002].sort(
  (a, b) => a.version - b.version
)
