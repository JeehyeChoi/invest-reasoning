CREATE TABLE IF NOT EXISTS sec_companyfact_company_state (
  cik TEXT PRIMARY KEY,
  entity_name TEXT,

  is_active BOOLEAN NOT NULL DEFAULT FALSE,

  last_file_size BIGINT,
  last_processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  last_filed DATE,
  last_end DATE,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sec_companyfact_company_state_active
  ON sec_companyfact_company_state (is_active);

CREATE INDEX IF NOT EXISTS idx_sec_companyfact_company_state_last_filed
  ON sec_companyfact_company_state (last_filed);

CREATE INDEX IF NOT EXISTS idx_sec_companyfact_company_state_last_end
  ON sec_companyfact_company_state (last_end);
