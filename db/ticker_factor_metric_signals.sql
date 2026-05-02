CREATE TABLE IF NOT EXISTS public.ticker_factor_metric_signals (
  id BIGSERIAL PRIMARY KEY,

  ticker TEXT NOT NULL,
  cik TEXT,

  factor TEXT NOT NULL,
  axis TEXT NOT NULL,
  metric_key TEXT NOT NULL,
  signal_key TEXT NOT NULL,

  signal_value DOUBLE PRECISION,

  period_end DATE,
  effective_date DATE NOT NULL,

  source_table TEXT,
  source_version TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_ticker_factor_metric_signals UNIQUE (
    ticker,
    factor,
    axis,
    metric_key,
    signal_key,
    period_end,
    effective_date
  )
);

CREATE INDEX IF NOT EXISTS idx_tfms_lookup
ON public.ticker_factor_metric_signals (
  ticker,
  factor,
  axis,
  metric_key,
  signal_key
);

CREATE INDEX IF NOT EXISTS idx_tfms_effective
ON public.ticker_factor_metric_signals (effective_date DESC);

CREATE INDEX IF NOT EXISTS idx_tfms_period
ON public.ticker_factor_metric_signals (period_end DESC);

CREATE INDEX IF NOT EXISTS idx_tfms_factor_axis_metric
ON public.ticker_factor_metric_signals (
  factor,
  axis,
  metric_key,
  signal_key
);
