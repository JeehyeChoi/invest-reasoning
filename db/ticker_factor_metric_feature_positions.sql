CREATE TABLE IF NOT EXISTS public.ticker_factor_metric_feature_positions (
  id BIGSERIAL PRIMARY KEY,

  ticker TEXT NOT NULL,
  cik TEXT NOT NULL,

  factor TEXT NOT NULL,
  axis TEXT NOT NULL,
  metric_key TEXT NOT NULL,
  feature_key TEXT NOT NULL,

  comparison_set_type TEXT NOT NULL,
  comparison_set_key TEXT NOT NULL,

  feature_value DOUBLE PRECISION,
  percentile DOUBLE PRECISION,
  z_score DOUBLE PRECISION,
  distance_to_median DOUBLE PRECISION,
  quartile INTEGER,
  decile INTEGER,
  universe_count INTEGER,

  effective_date DATE NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_ticker_factor_metric_feature_positions UNIQUE (
    cik,
    factor,
    axis,
    metric_key,
    feature_key,
    comparison_set_type,
    comparison_set_key,
    effective_date
  ),

  CONSTRAINT chk_tfmfp_percentile_range
  CHECK (percentile IS NULL OR (percentile >= 0 AND percentile <= 1)),

  CONSTRAINT chk_tfmfp_quartile_range
  CHECK (quartile IS NULL OR (quartile >= 1 AND quartile <= 4)),

  CONSTRAINT chk_tfmfp_decile_range
  CHECK (decile IS NULL OR (decile >= 1 AND decile <= 10)),

  CONSTRAINT chk_tfmfp_universe_count_positive
  CHECK (universe_count IS NULL OR universe_count > 0)
);

CREATE INDEX IF NOT EXISTS idx_tfmfp_lookup
ON public.ticker_factor_metric_feature_positions (
  cik,
  ticker,
  factor,
  axis,
  metric_key,
  feature_key
);

CREATE INDEX IF NOT EXISTS idx_tfmfp_comparison
ON public.ticker_factor_metric_feature_positions (
  comparison_set_type,
  comparison_set_key,
  factor,
  axis,
  metric_key,
  feature_key,
  effective_date DESC
);

CREATE INDEX IF NOT EXISTS idx_tfmfp_ticker_lookup
ON public.ticker_factor_metric_feature_positions (
  ticker,
  factor,
  axis,
  metric_key,
  feature_key
);

CREATE INDEX IF NOT EXISTS idx_tfmfp_percentile
ON public.ticker_factor_metric_feature_positions (
  factor,
  axis,
  metric_key,
  feature_key,
  comparison_set_type,
  comparison_set_key,
  percentile DESC
);
