CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS ticker_identities (
  ticker TEXT PRIMARY KEY,

  cik TEXT,
  company_name TEXT,
  exchange TEXT,
  exchange_full_name TEXT,

  source TEXT NOT NULL,

  fetched_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticker_identities_cik
ON ticker_identities(cik);

CREATE INDEX IF NOT EXISTS idx_ticker_identities_exchange
ON ticker_identities(exchange);

CREATE TABLE IF NOT EXISTS ticker_company_profiles (
  ticker TEXT PRIMARY KEY
    REFERENCES ticker_identities(ticker) ON DELETE CASCADE,

  description TEXT,
  website TEXT,
  ceo TEXT,

  country TEXT,
  state TEXT,
  city TEXT,
  zip TEXT,
  address TEXT,
  phone TEXT,

  full_time_employees INTEGER,
  ipo_date DATE,

  source TEXT NOT NULL,

  fetched_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticker_company_classifications (
  ticker TEXT PRIMARY KEY
    REFERENCES ticker_identities(ticker) ON DELETE CASCADE,

  sector TEXT,
  industry TEXT,
  sic TEXT,
  sic_description TEXT,

  currency TEXT,
  cusip TEXT,
  isin TEXT,

  is_etf BOOLEAN,
  is_fund BOOLEAN,
  is_adr BOOLEAN,
  is_actively_trading BOOLEAN,

  source TEXT NOT NULL,

  fetched_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticker_company_classifications_sector
ON ticker_company_classifications(sector);

CREATE INDEX IF NOT EXISTS idx_ticker_company_classifications_industry
ON ticker_company_classifications(industry);

CREATE INDEX IF NOT EXISTS idx_ticker_company_classifications_sic
ON ticker_company_classifications(sic);

CREATE TABLE IF NOT EXISTS ticker_market_snapshots (
  ticker TEXT PRIMARY KEY
    REFERENCES ticker_identities(ticker) ON DELETE CASCADE,

  price NUMERIC,
  market_cap NUMERIC,
  beta NUMERIC,
  last_dividend NUMERIC,

  fifty_two_week_range TEXT,
  price_change NUMERIC,
  price_change_percentage NUMERIC,

  volume BIGINT,
  average_volume BIGINT,
  snapshot_date DATE,

  source TEXT NOT NULL,

  fetched_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticker_market_snapshots_snapshot_date
ON ticker_market_snapshots(snapshot_date);

DROP TRIGGER IF EXISTS set_ticker_identities_updated_at ON ticker_identities;
CREATE TRIGGER set_ticker_identities_updated_at
BEFORE UPDATE ON ticker_identities
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_ticker_company_profiles_updated_at ON ticker_company_profiles;
CREATE TRIGGER set_ticker_company_profiles_updated_at
BEFORE UPDATE ON ticker_company_profiles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_ticker_company_classifications_updated_at ON ticker_company_classifications;
CREATE TRIGGER set_ticker_company_classifications_updated_at
BEFORE UPDATE ON ticker_company_classifications
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_ticker_market_snapshots_updated_at ON ticker_market_snapshots;
CREATE TRIGGER set_ticker_market_snapshots_updated_at
BEFORE UPDATE ON ticker_market_snapshots
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
