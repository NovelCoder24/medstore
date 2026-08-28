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

const ONES = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN']
const TENS = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY']

function convertChunk(num: number): string {
  if (num === 0) return ''
  if (num < 20) return ONES[num]
  if (num < 100) {
    const tens = TENS[Math.floor(num / 10)]
    const ones = ONES[num % 10]
    return ones ? `${tens} ${ones}` : tens
  }
  const hundreds = ONES[Math.floor(num / 100)]
  const rest = convertChunk(num % 100)
  return rest ? `${hundreds} HUNDRED AND ${rest}` : `${hundreds} HUNDRED`
}

/**
 * Convert numerical rupees to Indian English words in uppercase.
 * Example: 8400 -> "EIGHT THOUSAND FOUR HUNDRED ONLY"
 * Example: 13620 -> "THIRTEEN THOUSAND SIX HUNDRED AND TWENTY ONLY"
 */
export function numberToIndianWords(rupees: number): string {
  if (!rupees || rupees <= 0) return 'ZERO ONLY'

  const wholeRupees = Math.floor(rupees)
  const paise = Math.round((rupees - wholeRupees) * 100)

  let words = ''

  const crore = Math.floor(wholeRupees / 10000000)
  const rest1 = wholeRupees % 10000000

  const lakh = Math.floor(rest1 / 100000)
  const rest2 = rest1 % 100000

  const thousand = Math.floor(rest2 / 1000)
  const rest3 = rest2 % 1000

  const hundred = Math.floor(rest3 / 100)
  const units = rest3 % 100

  if (crore > 0) {
    words += `${convertChunk(crore)} CRORE `
  }
  if (lakh > 0) {
    words += `${convertChunk(lakh)} LAKH `
  }
  if (thousand > 0) {
    words += `${convertChunk(thousand)} THOUSAND `
  }
  if (hundred > 0) {
    words += `${ONES[hundred]} HUNDRED `
  }
  if (units > 0) {
    if (words !== '') {
      words += `AND ${convertChunk(units)} `
    } else {
      words += `${convertChunk(units)} `
    }
  }

  words = words.trim()

  if (paise > 0) {
    const paiseWords = convertChunk(paise)
    if (words) {
      return `${words} AND ${paiseWords} PAISE ONLY`.replace(/\s+/g, ' ')
    } else {
      return `${paiseWords} PAISE ONLY`.replace(/\s+/g, ' ')
    }
  }

  return `${words} ONLY`.replace(/\s+/g, ' ')
}

