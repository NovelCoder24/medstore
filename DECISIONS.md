# DECISIONS.md — Architecture & Design Decisions

## SQLite Configuration
- `synchronous = FULL` (not NORMAL) — chosen for power-loss resilience given
  unreliable small-town electricity and no confirmed UPS.

## Paise Conversion Boundary
- Gemini returns rupees (float). The OCR layer (`ocr.service.ts`,
  `vendor-ocr-profile.service.ts`) works exclusively in rupees.
- Conversion to integer paise happens at the point where OCR data enters
  the purchase domain: `PurchaseForm.tsx` for the Zustand store,
  `purchase.service.ts` for DB inserts.
- The purchase store holds paise since both OCR and manual-entry paths feed it.
- Do NOT add paise conversion inside `ocr.service.ts` or
  `vendor-ocr-profile.service.ts`.

## Roles
- Single OWNER role for V1 — no CASHIER/STAFF split; 5 staff work
  interchangeably.

## Barcode Scanner
- Optional for V1 launch; search-based billing is primary POS flow.

## V2 Scope (Out of Scope for V1)
- Generic substitution
- Audit logs
- Scheduled backups
- Role-based permissions (CASHIER/STAFF distinction)

## Architecture Rules
- Renderer NEVER imports directly from `main/services/*`.
- All shared types live in `src/shared/types.ts`.
- All renderer-to-main communication goes through preload IPC bridge.

## Vendor OCR Learning
- Correction history is capped at 50 entries (FIFO, oldest dropped).
- Correction learning is best-effort: if saving corrections fails, the
  purchase commit is NOT blocked. Wrapped in try/catch.
- The vendor profile is injected into the Gemini prompt only when a profile
  exists with actual content (name variants, corrections). New/empty vendors
  get the static prompt only.
