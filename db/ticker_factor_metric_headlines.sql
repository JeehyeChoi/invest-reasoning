CREATE TABLE IF NOT EXISTS public.ticker_factor_metric_headlines (
  id BIGSERIAL PRIMARY KEY,

  ticker TEXT NOT NULL,
  cik TEXT,

  factor TEXT NOT NULL,
  axis TEXT NOT NULL,
  metric_key TEXT NOT NULL,

  headline_period_end DATE NOT NULL,
  headline_effective_date DATE NOT NULL,

  latest_growth_value DOUBLE PRECISION,
  latest_growth_method TEXT,

  durable_growth_value DOUBLE PRECISION,
  durable_growth_method TEXT,

  consistency_value DOUBLE PRECISION,
  consistency_method TEXT,

  acceleration_value DOUBLE PRECISION,
  acceleration_method TEXT,

  trend_deviation_value DOUBLE PRECISION,
  trend_deviation_method TEXT,

  profitability_shift_value DOUBLE PRECISION,
  profitability_shift_method TEXT,

  shock_absorption_value DOUBLE PRECISION,
  shock_absorption_method TEXT,

  primary_signal_key TEXT,
  primary_signal_value DOUBLE PRECISION,
  primary_signal_method TEXT,

  source_table TEXT,
  source_version TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_ticker_factor_metric_headlines UNIQUE (
    ticker,
    factor,
    axis,
    metric_key,
    headline_effective_date
  ),

  CONSTRAINT chk_tfmh_consistency_range
  CHECK (consistency_value IS NULL OR (consistency_value >= 0 AND consistency_value <= 1))
);

ALTER TABLE public.ticker_factor_metric_headlines
ADD COLUMN IF NOT EXISTS profitability_shift_value DOUBLE PRECISION;

ALTER TABLE public.ticker_factor_metric_headlines
ADD COLUMN IF NOT EXISTS profitability_shift_method TEXT;

ALTER TABLE public.ticker_factor_metric_headlines
ADD COLUMN IF NOT EXISTS shock_absorption_value DOUBLE PRECISION;

ALTER TABLE public.ticker_factor_metric_headlines
ADD COLUMN IF NOT EXISTS shock_absorption_method TEXT;

CREATE INDEX IF NOT EXISTS idx_tfmh_lookup
ON public.ticker_factor_metric_headlines (
  ticker,
  factor,
  axis,
  metric_key
);

CREATE INDEX IF NOT EXISTS idx_tfmh_effective
ON public.ticker_factor_metric_headlines (
  factor,
  axis,
  metric_key,
  headline_effective_date DESC
);

CREATE INDEX IF NOT EXISTS idx_tfmh_primary_signal
ON public.ticker_factor_metric_headlines (
  factor,
  axis,
  metric_key,
  primary_signal_key
);
