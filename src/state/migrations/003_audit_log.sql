CREATE TABLE IF NOT EXISTS audit_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id      TEXT    NOT NULL,
  event_hash    TEXT    NOT NULL,
  classifier    TEXT    NOT NULL,  -- JSON
  score_bundle  TEXT    NOT NULL,  -- JSON
  mode          TEXT    NOT NULL,
  thesis        TEXT,              -- JSON, nullable
  prompt_hash   TEXT,
  model_id      TEXT    NOT NULL,
  validation    TEXT,              -- JSON, nullable
  final_action  TEXT    NOT NULL,  -- 'publish' | 'skip'
  skip_reason   TEXT,
  reply_text    TEXT,
  reply_hash    TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(event_id)
);

CREATE INDEX IF NOT EXISTS idx_audit_event_id ON audit_log(event_id);
CREATE INDEX IF NOT EXISTS idx_audit_created  ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_action   ON audit_log(final_action);
CREATE INDEX IF NOT EXISTS idx_audit_mode     ON audit_log(mode);
