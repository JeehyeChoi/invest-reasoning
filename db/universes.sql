CREATE TABLE IF NOT EXISTS universes (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS universe_memberships (
  id BIGSERIAL PRIMARY KEY,

  universe_key TEXT NOT NULL
    REFERENCES universes(key) ON DELETE CASCADE,

  ticker TEXT NOT NULL,
  company_name TEXT,
  sector TEXT,
  industry TEXT,
  cik TEXT,

  source TEXT NOT NULL,
  source_payload JSONB,
  effective_date DATE,
  fetched_at TIMESTAMP NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE (universe_key, ticker)
);

CREATE INDEX IF NOT EXISTS idx_universe_memberships_universe_active
ON universe_memberships(universe_key, is_active);

CREATE INDEX IF NOT EXISTS idx_universe_memberships_ticker
ON universe_memberships(ticker);

CREATE INDEX IF NOT EXISTS idx_universe_memberships_cik
ON universe_memberships(cik);

DROP TRIGGER IF EXISTS set_universes_updated_at ON universes;
CREATE TRIGGER set_universes_updated_at
BEFORE UPDATE ON universes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_universe_memberships_updated_at ON universe_memberships;
CREATE TRIGGER set_universe_memberships_updated_at
BEFORE UPDATE ON universe_memberships
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
