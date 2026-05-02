CREATE TABLE IF NOT EXISTS public.ticker_metric_series_reliability (
  id BIGSERIAL PRIMARY KEY,

  ticker TEXT NOT NULL,
  cik TEXT,
  metric_key TEXT NOT NULL,
  reliability_key TEXT NOT NULL,

  reliability_value DOUBLE PRECISION,

  period_end DATE,
  effective_date DATE NOT NULL,

  source_table TEXT,
  source_version TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_ticker_metric_series_reliability UNIQUE (
    ticker,
    metric_key,
    reliability_key,
    period_end,
    effective_date
  )
);

CREATE INDEX IF NOT EXISTS idx_tmsr_lookup
ON public.ticker_metric_series_reliability (
  ticker,
  metric_key,
  reliability_key
);

CREATE INDEX IF NOT EXISTS idx_tmsr_effective
ON public.ticker_metric_series_reliability (effective_date DESC);

CREATE INDEX IF NOT EXISTS idx_tmsr_period
ON public.ticker_metric_series_reliability (period_end DESC);

CREATE INDEX IF NOT EXISTS idx_tmsr_metric_reliability
ON public.ticker_metric_series_reliability (
  metric_key,
  reliability_key
);
