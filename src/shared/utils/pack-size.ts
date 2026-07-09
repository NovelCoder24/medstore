/**
 * Pack-size conversion utility.
 *
 * Indian pharmacies buy in strips/boxes but sell in individual pills.
 * All inventory quantities are stored in ATOMIC UNITS (individual pills/tablets).
 *
 * pack_size = how many atomic units in one selling pack (strip/box).
 *   e.g. pack_size = 15 means a strip of 15 tablets.
 *
 * Purchase: owner enters "10 strips" → system stores 10 × 15 = 150 units.
 * Sale:     cashier sells "2 strips" → system deducts 2 × 15 = 30 units.
 * Sale:     cashier sells "4 loose"  → system deducts 4 units.
 */

/**
 * Convert pack count to atomic units.
 *
 * @param packs    - Number of packs (strips/boxes)
 * @param packSize - Atomic units per pack (e.g. 15 for a strip of 15)
 * @returns Atomic unit count
 *
 * @example packsToUnits(10, 15) → 150
 */
export function packsToUnits(packs: number, packSize: number): number {
  if (!Number.isInteger(packs) || packs < 0) {
    throw new Error(`packs must be a non-negative integer, got ${packs}`)
  }
  if (!Number.isInteger(packSize) || packSize < 1) {
    throw new Error(`packSize must be a positive integer, got ${packSize}`)
  }
  return packs * packSize
}

/**
 * Convert atomic units back to a display-friendly packs + loose breakdown.
 *
 * @param units    - Total atomic units
 * @param packSize - Atomic units per pack
 * @returns Object with full packs count and remaining loose units
 *
 * @example unitsToDisplay(37, 15) → { packs: 2, loose: 7 }
 * @example unitsToDisplay(30, 15) → { packs: 2, loose: 0 }
 * @example unitsToDisplay(5, 1)   → { packs: 5, loose: 0 }
 */
export function unitsToDisplay(
  units: number,
  packSize: number
): { packs: number; loose: number } {
  if (!Number.isInteger(units) || units < 0) {
    throw new Error(`units must be a non-negative integer, got ${units}`)
  }
  if (!Number.isInteger(packSize) || packSize < 1) {
    throw new Error(`packSize must be a positive integer, got ${packSize}`)
  }
  return {
    packs: Math.floor(units / packSize),
    loose: units % packSize
  }
}

/**
 * Format atomic units as a human-readable stock string.
 *
 * @example formatStock(37, 15) → "2 strips + 7 loose"
 * @example formatStock(30, 15) → "2 strips"
 * @example formatStock(7, 15)  → "7 loose"
 * @example formatStock(5, 1)   → "5"
 */
export function formatStock(totalAtomicQty: number, packSize: number): string {
  if (totalAtomicQty === 0) return 'Out of Stock';
  
  // For Syrups, Ointments, Injections (Pack size is 1)
  if (packSize === 1) {
    return `${totalAtomicQty} Units`; 
  }

  // For Tablets/Capsules (Pack size > 1)
  const strips = Math.floor(totalAtomicQty / packSize);
  const loosePills = totalAtomicQty % packSize;

  if (strips > 0 && loosePills > 0) return `${strips} Strips + ${loosePills} Pills`;
  if (strips > 0 && loosePills === 0) return `${strips} Strips`;
  return `${loosePills} Pills`; // Less than 1 strip
}
