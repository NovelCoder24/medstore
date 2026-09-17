export const version = 14
export const name = 'ocr_queue'

export const sql = `
-- Table for asynchronous batch OCR invoice processing
CREATE TABLE IF NOT EXISTS ocr_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  image_hash TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK(status IN ('PENDING', 'PROCESSING', 'READY', 'FAILED', 'APPROVED', 'DISCARDED')) DEFAULT 'PENDING',
  extracted_data_json TEXT,
  error_message TEXT,
  vendor_name_preview TEXT,
  invoice_number_preview TEXT,
  invoice_date_preview TEXT,
  total_amount_preview REAL,
  item_count INTEGER DEFAULT 0,
  flagged_count INTEGER DEFAULT 0,
  vendor_hint_id INTEGER REFERENCES vendors(id) ON DELETE SET NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  processing_duration_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  processed_at TEXT,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_ocr_queue_image_hash ON ocr_queue(image_hash);
CREATE INDEX IF NOT EXISTS idx_ocr_queue_status ON ocr_queue(status, created_at);
CREATE INDEX IF NOT EXISTS idx_ocr_queue_created_at ON ocr_queue(created_at DESC);
`;
