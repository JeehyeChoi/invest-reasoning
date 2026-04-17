CREATE TABLE IF NOT EXISTS sec_bulk_ingest_state (
  dataset TEXT PRIMARY KEY,

  archive_path TEXT,
  archive_mtime_iso TIMESTAMPTZ,
  archive_file_size BIGINT,
  archive_status TEXT NOT NULL DEFAULT 'idle',
  archive_error TEXT,
  archive_checked_at TIMESTAMPTZ,

  ingest_status TEXT NOT NULL DEFAULT 'idle',
  ingest_error TEXT,
  ingest_started_at TIMESTAMPTZ,
  ingest_completed_at TIMESTAMPTZ,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_sec_bulk_ingest_state_archive_status
    CHECK (archive_status IN ('idle', 'downloading', 'ready', 'failed')),

  CONSTRAINT chk_sec_bulk_ingest_state_ingest_status
    CHECK (ingest_status IN ('idle', 'running', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_sec_bulk_ingest_state_archive_status
  ON sec_bulk_ingest_state (archive_status);

CREATE INDEX IF NOT EXISTS idx_sec_bulk_ingest_state_ingest_status
  ON sec_bulk_ingest_state (ingest_status);
