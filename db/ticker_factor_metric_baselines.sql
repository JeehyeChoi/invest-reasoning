CREATE TABLE IF NOT EXISTS public.ticker_factor_metric_baselines (
  id BIGSERIAL PRIMARY KEY,

  factor TEXT NOT NULL,
  axis TEXT NOT NULL,
  metric_key TEXT NOT NULL,
  signal_key TEXT NOT NULL,

  comparison_set_type TEXT NOT NULL,
  comparison_set_key TEXT NOT NULL,

  baseline_key TEXT NOT NULL,
  baseline_value DOUBLE PRECISION,
  universe_count INTEGER,

  effective_date DATE NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_ticker_factor_metric_baselines UNIQUE (
    factor,
    axis,
    metric_key,
    signal_key,
    comparison_set_type,
    comparison_set_key,
    baseline_key,
    effective_date
  ),

  CONSTRAINT chk_tfmb_universe_count_positive
  CHECK (universe_count IS NULL OR universe_count > 0)
);

CREATE INDEX IF NOT EXISTS idx_tfmb_lookup
ON public.ticker_factor_metric_baselines (
  factor,
  axis,
  metric_key,
  signal_key,
  comparison_set_type,
  comparison_set_key
);

CREATE INDEX IF NOT EXISTS idx_tfmb_baseline
ON public.ticker_factor_metric_baselines (
  comparison_set_type,
  comparison_set_key,
  baseline_key,
  effective_date DESC
);

CREATE INDEX IF NOT EXISTS idx_tfmb_effective
ON public.ticker_factor_metric_baselines (effective_date DESC);

CREATE INDEX IF NOT EXISTS idx_tfmb_factor_axis_metric
ON public.ticker_factor_metric_baselines (
  factor,
  axis,
  metric_key,
  signal_key
);
