CREATE TABLE IF NOT EXISTS public.ticker_provider_symbols (
  ticker TEXT NOT NULL,
  provider TEXT NOT NULL,

  provider_symbol TEXT,
  exchange TEXT,
  mic_code TEXT,
  country TEXT,
  instrument_type TEXT,

  status TEXT NOT NULL DEFAULT 'unresolved',
  source TEXT NOT NULL DEFAULT 'auto',
  candidate_symbols JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB,
  last_error TEXT,

  verified_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT pk_ticker_provider_symbols PRIMARY KEY (ticker, provider)
);

CREATE INDEX IF NOT EXISTS idx_ticker_provider_symbols_status
ON public.ticker_provider_symbols (provider, status, updated_at);

CREATE INDEX IF NOT EXISTS idx_ticker_provider_symbols_provider_symbol
ON public.ticker_provider_symbols (provider, provider_symbol);

ALTER TABLE public.ticker_provider_symbols
ADD COLUMN IF NOT EXISTS mic_code TEXT;
