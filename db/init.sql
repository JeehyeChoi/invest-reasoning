CREATE TABLE IF NOT EXISTS ticker_profiles (
  ticker TEXT PRIMARY KEY,

  company_name TEXT,
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

CREATE TABLE IF NOT EXISTS ticker_classifications (
  ticker TEXT PRIMARY KEY
    REFERENCES ticker_profiles(ticker) ON DELETE CASCADE,

  sector TEXT,
  industry TEXT,

  exchange TEXT,
  exchange_full_name TEXT,
  currency TEXT,

  cik TEXT,
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

CREATE TABLE IF NOT EXISTS ticker_market_data (
  ticker TEXT PRIMARY KEY
    REFERENCES ticker_profiles(ticker) ON DELETE CASCADE,

  price NUMERIC,
  market_cap NUMERIC,
  beta NUMERIC,
  last_dividend NUMERIC,

  fifty_two_week_range TEXT,
  price_change NUMERIC,
  price_change_percentage NUMERIC,

  volume BIGINT,
  average_volume BIGINT,

  fetched_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticker_tags (
  id BIGSERIAL PRIMARY KEY,

  ticker TEXT NOT NULL
    REFERENCES ticker_profiles(ticker) ON DELETE CASCADE,

  tag TEXT NOT NULL,
  source_rule TEXT,

  inferred_at TIMESTAMP NOT NULL DEFAULT NOW(),

  UNIQUE (ticker, tag)
);

CREATE INDEX IF NOT EXISTS idx_ticker_tags_ticker
ON ticker_tags(ticker);

CREATE INDEX IF NOT EXISTS idx_ticker_tags_tag
ON ticker_tags(tag);

CREATE INDEX IF NOT EXISTS idx_ticker_classifications_sector
ON ticker_classifications(sector);

CREATE INDEX IF NOT EXISTS idx_ticker_classifications_industry
ON ticker_classifications(industry);

CREATE INDEX IF NOT EXISTS idx_ticker_classifications_exchange
ON ticker_classifications(exchange);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_ticker_profiles_updated_at ON ticker_profiles;
CREATE TRIGGER set_ticker_profiles_updated_at
BEFORE UPDATE ON ticker_profiles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_ticker_classifications_updated_at ON ticker_classifications;
CREATE TRIGGER set_ticker_classifications_updated_at
BEFORE UPDATE ON ticker_classifications
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_ticker_market_data_updated_at ON ticker_market_data;
CREATE TRIGGER set_ticker_market_data_updated_at
BEFORE UPDATE ON ticker_market_data
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


