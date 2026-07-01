# MedStore POS — Architecture & Design Decisions

This document tracks major technical and business logic decisions made during the project.

## 1. Money Representation (Paise)
**Decision:** All monetary values are stored in the database and processed in memory as **integer paise** (1 Rupee = 100 paise).
**Reason:** Floating-point arithmetic on currency leads to precision errors (e.g. `0.1 + 0.2 = 0.30000000000000004`). Converting everything to integers prevents this entirely. We only convert back to floats/strings at the UI layer for display.

## 2. Inventory Quantities (Atomic Units)
**Decision:** All stock quantities are stored in **atomic units** (individual pills, tablets, ampoules). We do *not* store mixed pack sizes in the database.
**Reason:** Indian pharmacies buy in boxes/strips but sell in both strips and individual pills. If we store `10 strips`, and sell `2 pills`, it's a nightmare to track. By storing everything in pills (using `pack_size` only for conversion on input/display), math is simple: buy 1 strip (pack_size 15) -> add 15 to DB. Sell 2 pills -> subtract 2 from DB.

## 3. Barcode Strategy
**Decision:** Barcode is a `NULLABLE` field in the database.
**Reason:** Many generic and surgical items in India do not have barcodes. The primary lookup method is fast full-text search (FTS5). Barcodes are strictly an optional convenience feature for faster checkout.

## 4. SQLite WAL Mode
**Decision:** The database runs in WAL (Write-Ahead Logging) mode with `synchronous = NORMAL`.
**Reason:** We need concurrent read/write support, particularly for worker threads running heavy CSV imports or analytical grouping queries while the main thread needs to instantly create a POS bill.

## 5. GST Application Order
**Decision:** GST is applied **after** any item-level discounts.
`Taxable Value = Unit Price - Item Discount`.
**Reason:** Tax compliance. GST must only be paid on the actual value realized.

## 6. Worker Threads for Heavy Operations
**Decision:** All heavy CPU/IO tasks (Initial CSV Import, EOD Grouping Analytics, SQLite Backup to USB) must run in `src/main/workers/`.
**Reason:** Electron's main process runs the IPC bridge. If we block the main thread for 5 seconds importing 15,000 rows, the React renderer freezes entirely because IPC calls hang. Worker threads keep the POS perfectly responsive.

## 7. Manager Override Security
**Decision:** We use a 2-tier PIN system. Actions like `SALES_VOID` or `OVERRIDE_EXPIRED_STOCK` prompt a `<ManagerOverride />` modal requiring the `OWNER` PIN.
**Reason:** The cashier needs to keep their flow going. Instead of logging out and logging back in, the owner just types their 4-digit PIN on top of the cashier's session, which gets recorded in `audit_logs` via the `override_by_user_id` field.
