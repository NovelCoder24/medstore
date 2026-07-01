/**
 * Shared constants used by both main and renderer processes.
 */

// ── Roles ──
export const ROLES = {
  OWNER: 'OWNER',
  CASHIER: 'CASHIER'
} as const
export type Role = (typeof ROLES)[keyof typeof ROLES]

// ── Product Categories ──
export const PRODUCT_CATEGORIES = {
  ETHICAL: 'ETHICAL',
  GENERIC: 'GENERIC',
  OTC: 'OTC',
  SURGICAL: 'SURGICAL'
} as const
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[keyof typeof PRODUCT_CATEGORIES]

// ── Schedule Flags ──
export const SCHEDULE_FLAGS = {
  H: 'H',
  H1: 'H1',
  X: 'X',
  NONE: 'NONE'
} as const
export type ScheduleFlag = (typeof SCHEDULE_FLAGS)[keyof typeof SCHEDULE_FLAGS]

/** Schedule flags that require doctor details on the sale */
export const DOCTOR_REQUIRED_SCHEDULES: readonly ScheduleFlag[] = [
  SCHEDULE_FLAGS.H1,
  SCHEDULE_FLAGS.X
]

// ── Batch Status ──
export const BATCH_STATUSES = {
  ACTIVE: 'ACTIVE',
  QUARANTINED: 'QUARANTINED',
  EXPIRED: 'EXPIRED',
  RETURNED: 'RETURNED',
  DISPOSED: 'DISPOSED'
} as const
export type BatchStatus = (typeof BATCH_STATUSES)[keyof typeof BATCH_STATUSES]

// ── Stock Movement Types ──
export const MOVEMENT_TYPES = {
  PURCHASE_IN: 'PURCHASE_IN',
  SALE_OUT: 'SALE_OUT',
  RETURN_IN: 'RETURN_IN',
  RETURN_OUT: 'RETURN_OUT',
  ADJUSTMENT: 'ADJUSTMENT',
  DISPOSAL: 'DISPOSAL',
  EXPIRY_BLOCK: 'EXPIRY_BLOCK'
} as const
export type MovementType = (typeof MOVEMENT_TYPES)[keyof typeof MOVEMENT_TYPES]

// ── Payment Modes ──
export const PAYMENT_MODES = {
  CASH: 'CASH',
  UPI: 'UPI',
  CARD: 'CARD',
  CREDIT: 'CREDIT'
} as const
export type PaymentMode = (typeof PAYMENT_MODES)[keyof typeof PAYMENT_MODES]

// ── GST Types ──
export const GST_TYPES = {
  INTRA: 'INTRA',
  INTER: 'INTER'
} as const
export type GstType = (typeof GST_TYPES)[keyof typeof GST_TYPES]

// ── Expiry Alert Severity ──
export const EXPIRY_SEVERITY = {
  CRITICAL: 'CRITICAL',
  WARNING: 'WARNING',
  INFO: 'INFO'
} as const
export type ExpirySeverity = (typeof EXPIRY_SEVERITY)[keyof typeof EXPIRY_SEVERITY]

/** Expiry alert windows in days — sorted descending for dashboard display */
export const EXPIRY_ALERT_WINDOWS = [180, 90, 60, 30, 15, 7, 0] as const

// ── Invoice Source ──
export const INVOICE_SOURCES = {
  MANUAL: 'MANUAL',
  OCR: 'OCR'
} as const
export type InvoiceSource = (typeof INVOICE_SOURCES)[keyof typeof INVOICE_SOURCES]

// ── Verification Status ──
export const VERIFICATION_STATUSES = {
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED'
} as const
export type VerificationStatus =
  (typeof VERIFICATION_STATUSES)[keyof typeof VERIFICATION_STATUSES]

// ── App Defaults ──
export const APP_DEFAULTS = {
  /** Default GST rate for products (%) */
  GST_RATE_PCT: 12,
  /** Default pack size (1 = no packing, sold individually) */
  PACK_SIZE: 1,
  /** PIN length for login */
  PIN_LENGTH: 4,
  /** bcrypt salt rounds for PIN hashing */
  BCRYPT_SALT_ROUNDS: 10,
  /** Database filename */
  DB_FILENAME: 'medstore.db',
  /** Max search results per page */
  PAGE_SIZE: 50
} as const
