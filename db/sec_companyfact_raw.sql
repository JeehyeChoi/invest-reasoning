CREATE TABLE IF NOT EXISTS sec_companyfact_raw (
  id BIGSERIAL PRIMARY KEY,

  cik TEXT NOT NULL,
  entity_name TEXT,

  taxonomy TEXT NOT NULL,
  tag TEXT NOT NULL,
  unit TEXT NOT NULL,

  label TEXT,
  description TEXT,

  val DOUBLE PRECISION,
  start DATE,
  "end" DATE,

  accn TEXT,
  fy INTEGER,
  fp TEXT,
  form TEXT,
  filed DATE,
  frame TEXT,

  workflow_type TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_sec_companyfact_raw_fact
    UNIQUE (cik, taxonomy, tag, unit, accn, start, "end")
);

CREATE INDEX IF NOT EXISTS idx_sec_companyfact_raw_cik
  ON sec_companyfact_raw (cik);

CREATE INDEX IF NOT EXISTS idx_sec_companyfact_raw_lookup
  ON sec_companyfact_raw (cik, taxonomy, tag, unit);

CREATE INDEX IF NOT EXISTS idx_sec_companyfact_raw_tag
  ON sec_companyfact_raw (tag);

CREATE INDEX IF NOT EXISTS idx_sec_companyfact_raw_end
  ON sec_companyfact_raw ("end");

CREATE INDEX IF NOT EXISTS idx_sec_companyfact_raw_filed
  ON sec_companyfact_raw (filed);

CREATE INDEX IF NOT EXISTS idx_sec_companyfact_raw_accn
  ON sec_companyfact_raw (accn);
