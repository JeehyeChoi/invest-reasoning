CREATE TABLE IF NOT EXISTS public.ticker_factor_metric_signal_headlines (
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

  coverage_value DOUBLE PRECISION,
  coverage_method TEXT,

  acceleration_value DOUBLE PRECISION,
  acceleration_method TEXT,

  trend_deviation_value DOUBLE PRECISION,
  trend_deviation_method TEXT,

  primary_signal_key TEXT,
  primary_signal_value DOUBLE PRECISION,
  primary_signal_method TEXT,

  data_quality_level TEXT,

  source_table TEXT,
  source_version TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_ticker_factor_metric_signal_headlines UNIQUE (
    ticker,
    factor,
    axis,
    metric_key,
    headline_effective_date
  ),

  CONSTRAINT chk_tfms_headlines_coverage_range
  CHECK (coverage_value IS NULL OR (coverage_value >= 0 AND coverage_value <= 1)),

  CONSTRAINT chk_tfms_headlines_consistency_range
  CHECK (consistency_value IS NULL OR (consistency_value >= 0 AND consistency_value <= 1)),

  CONSTRAINT chk_tfms_headlines_data_quality_level
  CHECK (
    data_quality_level IS NULL OR
    data_quality_level IN ('high', 'medium', 'low')
  )
);

CREATE INDEX IF NOT EXISTS idx_tfms_headlines_lookup
ON public.ticker_factor_metric_signal_headlines (
  ticker,
  factor,
  axis,
  metric_key
);

CREATE INDEX IF NOT EXISTS idx_tfms_headlines_effective
ON public.ticker_factor_metric_signal_headlines (
  factor,
  axis,
  metric_key,
  headline_effective_date DESC
);

CREATE INDEX IF NOT EXISTS idx_tfms_headlines_primary_signal
ON public.ticker_factor_metric_signal_headlines (
  factor,
  axis,
  metric_key,
  primary_signal_key
);
