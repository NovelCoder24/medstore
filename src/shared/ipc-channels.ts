/**
 * IPC Channel constants — the single source of truth for all IPC communication.
 *
 * Rules:
 * - Every channel used between renderer ↔ main MUST be listed here.
 * - The preload script allowlists only these channels.
 * - Adding a channel here is sufficient to make it available; no other registration needed.
 */

export const IPC_CHANNELS = {
  // ── Database (Phase 0) ──
  DB_STATUS: 'db:status',

  // ── Settings (safeStorage) ──
  SETTINGS_GET_SECRET: 'settings:get-secret',
  SETTINGS_SET_SECRET: 'settings:set-secret',

  // ── Users & Auth (Phase 1) ──
  USERS_LOGIN: 'users:login',
  USERS_VERIFY_OWNER_PIN: 'users:verify-owner-pin',
  USERS_CREATE: 'users:create',
  USERS_UPDATE: 'users:update',
  USERS_LIST: 'users:list',
  USERS_DEACTIVATE: 'users:deactivate',
  USERS_CHECK_FIRST_RUN: 'users:check-first-run',

  // ── Products (Phase 1) ──
  PRODUCTS_SEARCH: 'products:search',
  PRODUCTS_GET: 'products:get',
  PRODUCTS_CREATE: 'products:create',
  PRODUCTS_UPDATE: 'products:update',
  PRODUCTS_DELETE: 'products:delete',
  PRODUCTS_LIST: 'products:list',

  // ── Compositions (Phase 1) ──
  COMPOSITIONS_LIST: 'compositions:list',
  COMPOSITIONS_CREATE: 'compositions:create',
  COMPOSITIONS_UPDATE: 'compositions:update',

  // ── Vendors (Phase 1) ──
  VENDORS_LIST: 'vendors:list',
  VENDORS_GET: 'vendors:get',
  VENDORS_CREATE: 'vendors:create',
  VENDORS_UPDATE: 'vendors:update',
  VENDORS_RECORD_PAYMENT: 'vendors:record-payment',
  VENDORS_GET_LEDGER: 'vendors:get-ledger',
  VENDORS_GET_PAYMENTS: 'vendors:get-payments',

  // ── CSV Import (Phase 1) ──
  IMPORT_CSV: 'import:csv',
  IMPORT_PROGRESS: 'import:progress',

  // ── Batches (Phase 2) ──
  BATCHES_LIST_BY_PRODUCT: 'batches:list-by-product',
  BATCHES_UPDATE_STATUS: 'batches:update-status',
  BATCHES_UPDATE: 'batches:update',
  BATCHES_DELETE: 'batches:delete',
  BATCHES_GET_RETURNED: 'batches:get-returned',

  // ── Purchases (Phase 2) ──
  PURCHASES_CREATE: 'purchases:create',
  PURCHASES_LIST: 'purchases:list',
  PURCHASES_GET: 'purchases:get',
  PURCHASES_APPROVE_OCR: 'purchases:approve-ocr',

  // ── Expiry (Phase 2) ──
  EXPIRY_DASHBOARD: 'expiry:dashboard',
  EXPIRY_RUN_CHECK: 'expiry:run-check',

  // ── Sales / POS (Phase 3) ──
  SALES_CREATE: 'sales:create',
  SALES_GET: 'sales:get',
  SALES_LIST: 'sales:list',
  SALES_VOID: 'sales:void',
  SALES_RETURN: 'sales:return',
  SALES_SUSPEND: 'sales:suspend',
  SALES_RECALL: 'sales:recall',
  SALES_LIST_SUSPENDED: 'sales:list-suspended',

  // ── Printing (Phase 4) ──
  PRINT_RECEIPT: 'print:receipt',
  PRINT_TEST: 'print:test',
  PRINT_PDF: 'print:pdf',

  // ── OCR (Phase 5) ──
  OCR_EXTRACT: 'ocr:extract',
  OCR_GET_EXTRACTION: 'ocr:get-extraction',

  // ── Reports (Phase 6) ──
  REPORTS_DAILY_SUMMARY: 'reports:daily-summary',
  REPORTS_PROFIT_ANALYSIS: 'reports:profit-analysis',
  REPORTS_EXPIRY_VALUE: 'reports:expiry-value',
  REPORTS_LOW_STOCK: 'reports:low-stock',
  REPORTS_GSTR1: 'reports:gstr1',
  REPORTS_SCHEDULE_REGISTER: 'reports:schedule-register',

  // ── Supplier Returns (Phase 7) ──
  SUPPLIER_RETURNS_CREATE: 'supplier-returns:create',
  SUPPLIER_RETURNS_LIST: 'supplier-returns:list',

  // ── Audit (Phase 7) ──
  AUDIT_LOG_LIST: 'audit:list',

  // ── Customers (Khata) (Phase 7) ──
  CUSTOMERS_CREATE: 'customers:create',
  CUSTOMERS_SEARCH: 'customers:search',
  CUSTOMERS_GET: 'customers:get',
  CUSTOMERS_LEDGER: 'customers:ledger',
  CUSTOMERS_ACCEPT_PAYMENT: 'customers:accept-payment',
  CUSTOMERS_LIST: 'customers:list',

  // ── Settings (Phase 1+) ──
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_GET_ALL: 'settings:get-all',

  // ── Backup (Phase 8) ──
  BACKUP_CREATE: 'backup:create',
  BACKUP_RESTORE: 'backup:restore',
  BACKUP_LIST: 'backup:list',
  BACKUP_PROGRESS: 'backup:progress'
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]

/** Flat array of all allowed channel strings — used by preload allowlist */
export const ALLOWED_CHANNELS: readonly string[] = Object.values(IPC_CHANNELS)
