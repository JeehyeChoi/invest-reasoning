CREATE TABLE IF NOT EXISTS public.ticker_derived_metric_series (
  id BIGSERIAL PRIMARY KEY,

  ticker TEXT NOT NULL,
  cik TEXT,

  axis TEXT NOT NULL,
  process_key TEXT NOT NULL,
  source_kind TEXT NOT NULL,
  derived_metric_key TEXT NOT NULL,

  value DOUBLE PRECISION NOT NULL,
  value_type TEXT NOT NULL,

  benchmark_key TEXT,
  window_start DATE,
  window_end DATE,

  period_end DATE,
  effective_date DATE NOT NULL,

  source_table TEXT,
  source_version TEXT NOT NULL,
  source_payload JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_ticker_derived_metric_series UNIQUE (
    ticker,
    axis,
    process_key,
    source_kind,
    derived_metric_key,
    benchmark_key,
    window_start,
    window_end,
    period_end,
    effective_date,
    source_version
  )
);

CREATE INDEX IF NOT EXISTS idx_ticker_derived_metric_series_lookup
ON public.ticker_derived_metric_series (
  ticker,
  axis,
  process_key,
  source_kind,
  derived_metric_key,
  benchmark_key,
  effective_date DESC
);

CREATE INDEX IF NOT EXISTS idx_ticker_derived_metric_series_cik_lookup
ON public.ticker_derived_metric_series (
  cik,
  axis,
  process_key,
  source_kind,
  derived_metric_key,
  benchmark_key,
  effective_date DESC
);

CREATE INDEX IF NOT EXISTS idx_ticker_derived_metric_series_metric_effective
ON public.ticker_derived_metric_series (
  axis,
  process_key,
  source_kind,
  derived_metric_key,
  benchmark_key,
  effective_date DESC
);

CREATE INDEX IF NOT EXISTS idx_ticker_derived_metric_series_window
ON public.ticker_derived_metric_series (
  axis,
  process_key,
  source_kind,
  window_end DESC,
  window_start DESC
);
