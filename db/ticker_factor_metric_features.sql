CREATE TABLE IF NOT EXISTS public.ticker_factor_metric_features (
  id BIGSERIAL PRIMARY KEY,

  ticker TEXT NOT NULL,
  cik TEXT,

  factor TEXT NOT NULL,
  axis TEXT NOT NULL,
  metric_key TEXT NOT NULL,
  feature_key TEXT NOT NULL,

  feature_value DOUBLE PRECISION,

  period_end DATE,
  effective_date DATE NOT NULL,

  source_table TEXT,
  source_version TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_ticker_factor_metric_features UNIQUE (
    ticker,
    factor,
    axis,
    metric_key,
    feature_key,
    period_end,
    effective_date
  )
);

CREATE INDEX IF NOT EXISTS idx_tfmf_lookup
ON public.ticker_factor_metric_features (
  ticker,
  factor,
  axis,
  metric_key,
  feature_key
);

CREATE INDEX IF NOT EXISTS idx_tfmf_effective
ON public.ticker_factor_metric_features (effective_date DESC);

CREATE INDEX IF NOT EXISTS idx_tfmf_period
ON public.ticker_factor_metric_features (period_end DESC);

CREATE INDEX IF NOT EXISTS idx_tfmf_factor_axis_metric
ON public.ticker_factor_metric_features (
  factor,
  axis,
  metric_key,
  feature_key
);
