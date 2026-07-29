# MedStore POS & Inventory: Prioritized Implementation Plan

This implementation plan details the step-by-step execution roadmap to resolve all findings from the comprehensive audit. Implementation will proceed strictly in order of priority: **P0 (Critical Data & Tax Integrity)** $\rightarrow$ **P1 (Payload Validation & Code Safety)** $\rightarrow$ **P2 (UI/UX, Performance & Error Boundaries)**.

---

## User Review Required

> [!IMPORTANT]
> **P0 Priority (Data & Tax Safety)** changes will enforce strict server-side calculation and verification of financial totals.
> - Client payloads will no longer dictate final total amounts in the database.
> - GST taxable values for sales will be calculated using the Indian retail GST-inclusive formula ($\text{Taxable Value} = \frac{\text{Line Total} \times 100}{100 + \text{GST Rate}}$), matching [gst.ts](file:///d:/Projects/medical/src/shared/utils/gst.ts).
> - Zero operational UI changes for cashiers—the application UI, flow, and speed remain 100% identical.

---

## Proposed Changes

### Phase 1: P0 Critical Financial & Database Integrity Fixes

#### [MODIFY] [sales.service.ts](file:///d:/Projects/medical/src/main/services/sales.service.ts)
- Import `calculateItemGst` and `aggregateGst` from `../../shared/utils/gst`.
- Inside `createSale`, recalculate line item taxable values and taxes using `calculateItemGst`.
- Sum all line items to compute `expectedGrandTotalPaise`.
- Compare calculated totals against incoming `payload` totals. If there is a mismatch exceeding a 1-paise rounding tolerance, throw an explicit error (`PAYLOAD_TOTAL_MISMATCH`).
- Fix `processSalesReturn` integer division rounding loss by tracking exact unit refund allocations and distributing remainders.

#### [MODIFY] [purchase.service.ts](file:///d:/Projects/medical/src/main/services/purchase.service.ts)
- Inside `createPurchase`, verify that `quantityUnits` matches `quantityPacks * packSize` for the product.
- Recalculate line totals and invoice totals on the server; throw on mismatch.

---

### Phase 2: P1 Data Validation & Type Safety

#### [NEW] [schemas.ts](file:///d:/Projects/medical/src/shared/schemas.ts)
- Create Zod validation schemas for all key IPC payloads:
  - `SalePayloadSchema` (validates `items`, `quantityUnits > 0`, non-negative rates)
  - `PurchasePayloadSchema` (validates vendor, invoice number, line items)
  - `CustomerPaymentSchema` (enforces `amountPaise > 0`)

#### [MODIFY] [customer.service.ts](file:///d:/Projects/medical/src/main/services/customer.service.ts)
- Add validation to `acceptPayment` asserting `amountPaise > 0` to prevent negative payment entry attacks.

#### [MODIFY] [tsconfig.node.json](file:///d:/Projects/medical/tsconfig.node.json) & [tsconfig.web.json](file:///d:/Projects/medical/tsconfig.web.json)
- Add `"noImplicitAny": true` to enforce strict TypeScript type checking across renderer and main processes.

---

### Phase 3: P2 UI/UX, Performance & Error Boundaries

#### [NEW] [ErrorBoundary.tsx](file:///d:/Projects/medical/src/renderer/components/layout/ErrorBoundary.tsx)
- Create a React Error Boundary component to catch unhandled rendering exceptions gracefully and prevent blank screens.

#### [MODIFY] [Layout.tsx](file:///d:/Projects/medical/src/renderer/components/layout/Layout.tsx)
- Wrap the main tab content container inside `<ErrorBoundary>`.

#### [MODIFY] [PosBilling.tsx](file:///d:/Projects/medical/src/renderer/components/pos/PosBilling.tsx)
- Add a global `keydown` event listener for `F12` to trigger checkout directly from anywhere in the POS view.

#### [MODIFY] [ProductSearchDropdown.tsx](file:///d:/Projects/medical/src/renderer/components/pos/ProductSearchDropdown.tsx)
- Implement `ArrowDown`, `ArrowUp`, and `Enter` key handlers to allow keyboard-only medicine selection in the search dropdown.

#### [MODIFY] [ProductList.tsx](file:///d:/Projects/medical/src/renderer/components/catalog/ProductList.tsx)
- Integrate table row virtualization with `@tanstack/react-virtual` to maintain 60fps scrolling performance on low-spec pharmacy terminals with 5000+ items.

---

## Verification Plan

### Automated Tests
- Run existing Vitest unit and database test suites:
  ```bash
  npm run test
  ```
- Write a new backend unit test in `tests/sales.test.ts` verifying that:
  1. `createSale` correctly reverse-calculates GST-inclusive taxable values.
  2. `createSale` rejects tampered client payloads where `grandTotal` differs from the sum of items.
  3. `acceptPayment` rejects negative payment amounts.

### Manual Verification
1. Launch dev server using `npm run dev`.
2. Add items to cart in POS Billing, press `F12`, and complete a test sale.
3. Verify bill record in `Sales History` for correct total and tax breakdown.
4. Test keyboard arrow navigation in the medicine search dropdown.
5. Create a customer payment and test edge cases.
