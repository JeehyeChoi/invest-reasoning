CREATE TABLE IF NOT EXISTS public.ticker_factor_metric_macro_contrasts (
  id BIGSERIAL PRIMARY KEY,

  ticker TEXT NOT NULL,
  cik TEXT,

  factor TEXT NOT NULL,
  axis TEXT NOT NULL,
  metric_key TEXT NOT NULL,
  feature_key TEXT NOT NULL,

  feature_value DOUBLE PRECISION,
  feature_period_end DATE,
  feature_effective_date DATE NOT NULL,

  macro_scope TEXT NOT NULL,
  macro_provider TEXT NOT NULL,
  macro_series_key TEXT NOT NULL,
  macro_series_id TEXT NOT NULL,
  macro_units TEXT NOT NULL,
  macro_frequency TEXT NOT NULL,
  macro_observation_date DATE NOT NULL,
  macro_value DOUBLE PRECISION,

  contrast_method TEXT NOT NULL,
  contrast_value DOUBLE PRECISION,

  effective_date DATE NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_ticker_factor_metric_macro_contrasts UNIQUE (
    ticker,
    factor,
    axis,
    metric_key,
    feature_key,
    macro_scope,
    macro_provider,
    macro_series_key,
    effective_date
  ),

  CONSTRAINT chk_tfmmc_macro_provider
  CHECK (macro_provider IN ('fred')),

  CONSTRAINT chk_tfmmc_macro_scope
  CHECK (macro_scope IN ('usa')),

  CONSTRAINT chk_tfmmc_contrast_method
  CHECK (contrast_method IN ('feature_minus_macro'))
);

CREATE INDEX IF NOT EXISTS idx_tfmmc_ticker_lookup
ON public.ticker_factor_metric_macro_contrasts (
  cik,
  ticker,
  factor,
  axis,
  metric_key,
  feature_key,
  effective_date DESC
);

CREATE INDEX IF NOT EXISTS idx_tfmmc_macro_lookup
ON public.ticker_factor_metric_macro_contrasts (
  macro_scope,
  macro_provider,
  macro_series_key,
  effective_date DESC
);

CREATE INDEX IF NOT EXISTS idx_tfmmc_contrast
ON public.ticker_factor_metric_macro_contrasts (
  factor,
  axis,
  metric_key,
  feature_key,
  macro_scope,
  macro_series_key,
  contrast_value DESC
);
