export const version = 8
export const name = '008_audit_entity_name'
export const sql = `
  ALTER TABLE audit_logs ADD COLUMN entity_name TEXT DEFAULT '';
  CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created ON audit_logs(action, created_at);
`
