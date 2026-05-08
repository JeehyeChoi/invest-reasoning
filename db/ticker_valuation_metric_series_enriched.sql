CREATE TABLE IF NOT EXISTS public.ticker_valuation_metric_series_enriched (
  id BIGSERIAL PRIMARY KEY,

  ticker TEXT NOT NULL,
  cik TEXT,

  metric_key TEXT NOT NULL,
  metric_value DOUBLE PRECISION NOT NULL,

  period_end DATE,
  effective_date DATE NOT NULL,

  source_table TEXT,
  source_version TEXT,
  source_payload JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_ticker_valuation_metric_series_enriched UNIQUE (
    ticker,
    metric_key,
    period_end,
    effective_date
  )
);

CREATE INDEX IF NOT EXISTS idx_tvms_enriched_lookup
ON public.ticker_valuation_metric_series_enriched (
  ticker,
  metric_key,
  effective_date DESC
);

CREATE INDEX IF NOT EXISTS idx_tvms_enriched_metric_effective
ON public.ticker_valuation_metric_series_enriched (
  metric_key,
  effective_date DESC
);
