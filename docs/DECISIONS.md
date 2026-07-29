# MedStore POS — Architecture & Design Decisions

This document tracks major technical and business logic decisions made during the project.

## 1. Money Representation (Paise & Conversion Boundary)
* **Decision:** All monetary values are stored in the database and processed in memory as **integer paise** (1 Rupee = 100 paise).
* **Reason:** Floating-point arithmetic on currency leads to precision errors (e.g., `0.1 + 0.2 = 0.30000000000000004`). Converting everything to integers prevents this entirely. We only convert back to floats/strings at the UI layer for display.
* **Conversion Boundary:** Gemini OCR returns values in rupees (float). The OCR service layer (`ocr.service.ts`, `vendor-ocr-profile.service.ts`) works exclusively in rupees. Conversion to integer paise happens at the point where OCR data enters the purchase domain: `PurchaseForm.tsx` for the Zustand store, and `purchase.service.ts` for DB inserts. The purchase store holds paise since both OCR and manual-entry paths feed it. Do NOT add paise conversion inside the OCR services.

## 2. Inventory Quantities (Atomic Units)
* **Decision:** All stock quantities are stored in **atomic units** (individual pills, tablets, ampoules). We do *not* store mixed pack sizes in the database.
* **Reason:** Indian pharmacies buy in boxes/strips but sell in both strips and individual pills. If we store `10 strips` and sell `2 pills`, it's a nightmare to track. By storing everything in pills (using `pack_size` only for conversion on input/display), math is simple: buy 1 strip (pack_size 15) -> add 15 to DB. Sell 2 pills -> subtract 2 from DB.

## 3. Barcode Strategy
* **Decision:** Barcodes are optional (`NULLABLE` field in the database).
* **Reason:** Many generic and surgical items in India do not have barcodes. The primary lookup method is fast full-text search (FTS5). Barcodes are strictly an optional convenience feature for faster checkout in future phases.

## 4. SQLite Configuration & WAL Mode
* **Decision:** The database runs in WAL (Write-Ahead Logging) mode with `synchronous = FULL` (not `NORMAL`).
* **Reason:** WAL mode is critical for concurrent read/write support, particularly for worker threads running heavy CSV imports or analytical queries while the main thread instantly creates a POS bill. We use `synchronous = FULL` instead of `NORMAL` for power-loss resilience, given unreliable small-town electricity and no confirmed UPS.

## 5. GST Application Order
* **Decision:** GST is applied **after** any item-level discounts.
* `Taxable Value = Unit Price - Item Discount`.
* **Reason:** Tax compliance. GST must only be paid on the actual value realized.

## 6. Worker Threads for Heavy Operations
* **Decision:** All heavy CPU/IO tasks (Initial CSV Import, EOD Grouping Analytics, SQLite Backup to USB) must run in background worker threads (`src/main/workers/`).
* **Reason:** Electron's main process runs the IPC bridge. If we block the main thread for 5 seconds importing 15,000 rows, the React renderer freezes entirely because IPC calls hang. Worker threads keep the POS perfectly responsive.

## 7. Role-Based Access & Security
* **Decision:** Single `OWNER` role for V1 — no CASHIER/STAFF split; 5 staff work interchangeably.
* **V2 Scope:** Role-based permissions (CASHIER/STAFF distinction) and Manager overrides (2-tier PIN system for actions like `SALES_VOID` or `OVERRIDE_EXPIRED_STOCK`) are deferred to V2.

## 8. Architecture & IPC Rules
* **Decision:** The React Renderer must **NEVER** import directly from `main/services/*`.
* **Reason:** Main process services run in the Node.js context and utilize native/DB APIs which are unavailable and insecure to expose directly in the renderer process. All renderer-to-main communication must go through the Preload IPC bridge.
* **Shared Types:** All shared types must reside in `src/shared/types.ts`.

## 9. Vendor OCR Learning (AI OCR Profile)
* **Decision:** Correction history is capped at 50 entries (FIFO, oldest dropped).
* **Reason:** Limit database growth and avoid over-fitting prompt corrections.
* **Robustness:** Correction learning is best-effort: if saving corrections fails, the purchase commit is NOT blocked (wrapped in try/catch).
* **Prompt Injection:** The vendor profile is injected into the Gemini prompt only when a profile exists with actual content (name variants, corrections). New/empty vendors get the static prompt only.
