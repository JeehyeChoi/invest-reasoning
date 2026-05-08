CREATE TABLE IF NOT EXISTS public.ticker_daily_prices (
  id BIGSERIAL PRIMARY KEY,

  ticker TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_symbol TEXT NOT NULL,
  price_date DATE NOT NULL,

  open DOUBLE PRECISION,
  high DOUBLE PRECISION,
  low DOUBLE PRECISION,
  close DOUBLE PRECISION NOT NULL,
  volume BIGINT,

  adjustment_policy TEXT NOT NULL,
  source_payload JSONB,

  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_ticker_daily_prices_provider_date UNIQUE (
    ticker,
    provider,
    adjustment_policy,
    price_date
  )
);

CREATE INDEX IF NOT EXISTS idx_ticker_daily_prices_lookup
ON public.ticker_daily_prices (
  ticker,
  adjustment_policy,
  price_date DESC
);

CREATE INDEX IF NOT EXISTS idx_ticker_daily_prices_provider_lookup
ON public.ticker_daily_prices (
  provider,
  ticker,
  price_date DESC
);

CREATE TABLE IF NOT EXISTS public.ticker_daily_price_sync_state (
  ticker TEXT NOT NULL,
  provider TEXT NOT NULL,
  adjustment_policy TEXT NOT NULL,

  provider_symbol TEXT,
  target_start_date DATE,
  earliest_price_date DATE,
  latest_price_date DATE,
  row_count INTEGER NOT NULL DEFAULT 0,

  status TEXT NOT NULL,
  last_error TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT pk_ticker_daily_price_sync_state PRIMARY KEY (
    ticker,
    provider,
    adjustment_policy
  )
);

CREATE INDEX IF NOT EXISTS idx_ticker_daily_price_sync_state_status
ON public.ticker_daily_price_sync_state (
  provider,
  adjustment_policy,
  status,
  updated_at
);
