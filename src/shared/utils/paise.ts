/**
 * Paise utility — all monetary values are stored and computed as integer paise.
 *
 * ₹1.00 = 100 paise. This eliminates all floating-point arithmetic on money.
 * The Paise branded type enforces type safety at compile time.
 */

/** Branded type: a number known to represent paise (integer) */
export type Paise = number & { readonly __brand: 'paise' }

/**
 * Convert rupees (float) to paise (integer).
 * Rounds to nearest integer to handle floating-point imprecision.
 *
 * @example toPaise(152.50) → 15250 as Paise
 */
export function toPaise(rupees: number): Paise {
  return Math.round(rupees * 100) as Paise
}

/**
 * Convert paise (integer) to rupees (float) for display only.
 * NEVER use the returned float for further arithmetic — convert back to paise first.
 *
 * @example toRupees(15250 as Paise) → 152.50
 */
export function toRupees(paise: Paise): number {
  return paise / 100
}

/**
 * Format paise as a rupee string for display.
 *
 * @example formatPaise(15250 as Paise) → "₹152.50"
 * @example formatPaise(15250 as Paise, false) → "152.50"
 */
export function formatPaise(paise: Paise, withSymbol = true): string {
  const rupees = (paise / 100).toFixed(2)
  return withSymbol ? `₹${rupees}` : rupees
}

/** Add two paise values */
export function addPaise(a: Paise, b: Paise): Paise {
  return (a + b) as Paise
}

/** Subtract b from a (a - b) in paise */
export function subtractPaise(a: Paise, b: Paise): Paise {
  return (a - b) as Paise
}

/** Multiply paise by an integer quantity */
export function multiplyPaise(paise: Paise, quantity: number): Paise {
  return (paise * quantity) as Paise
}

/**
 * Calculate a percentage of a paise value, rounding to nearest integer.
 *
 * @example percentOfPaise(10000 as Paise, 12) → 1200 as Paise (12% of ₹100)
 */
export function percentOfPaise(paise: Paise, percent: number): Paise {
  return Math.round(paise * percent / 100) as Paise
}

/**
 * Assert that a number is a valid paise value (integer, non-negative).
 * Throws if invalid.
 */
export function assertPaise(value: number, fieldName = 'amount'): Paise {
  if (!Number.isInteger(value)) {
    throw new Error(`${fieldName} must be an integer (paise), got ${value}`)
  }
  if (value < 0) {
    throw new Error(`${fieldName} must be non-negative, got ${value}`)
  }
  return value as Paise
}
