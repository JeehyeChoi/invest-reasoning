CREATE TABLE IF NOT EXISTS public.ticker_signal_core_forward_returns (
  id BIGSERIAL PRIMARY KEY,

  as_of_date DATE NOT NULL,
  axis_scope TEXT NOT NULL DEFAULT 'fundamentals',
  lens TEXT NOT NULL DEFAULT 'idfWeightedJaccard',

  previous_threshold DOUBLE PRECISION NOT NULL,
  peak_threshold DOUBLE PRECISION NOT NULL,
  core_group_count INTEGER NOT NULL,
  core_ticker_count INTEGER NOT NULL,

  provider TEXT NOT NULL,
  adjustment_policy TEXT NOT NULL,
  windows JSONB NOT NULL DEFAULT '[]'::jsonb,
  summaries JSONB NOT NULL DEFAULT '[]'::jsonb,
  benchmark_tickers JSONB NOT NULL DEFAULT '[]'::jsonb,
  benchmark_summaries JSONB NOT NULL DEFAULT '[]'::jsonb,

  source_model_key TEXT NOT NULL DEFAULT 'factor_signal',
  source_model_version TEXT NOT NULL DEFAULT 'v0',

  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_tscfr_event UNIQUE (
    as_of_date,
    axis_scope,
    lens,
    provider,
    adjustment_policy,
    source_model_key,
    source_model_version
  ),

  CONSTRAINT chk_tscfr_axis_scope
  CHECK (
    axis_scope IN (
      'all',
      'fundamentals',
      'price_linked'
    )
  ),

  CONSTRAINT chk_tscfr_lens
  CHECK (lens IN ('idfWeightedJaccard')),

  CONSTRAINT chk_tscfr_counts_nonnegative
  CHECK (
    core_group_count >= 0
    AND core_ticker_count >= 0
  ),

  CONSTRAINT chk_tscfr_windows_array
  CHECK (jsonb_typeof(windows) = 'array'),

  CONSTRAINT chk_tscfr_summaries_array
  CHECK (jsonb_typeof(summaries) = 'array'),

  CONSTRAINT chk_tscfr_benchmark_tickers_array
  CHECK (jsonb_typeof(benchmark_tickers) = 'array'),

  CONSTRAINT chk_tscfr_benchmark_summaries_array
  CHECK (jsonb_typeof(benchmark_summaries) = 'array')
);

ALTER TABLE public.ticker_signal_core_forward_returns
ADD COLUMN IF NOT EXISTS benchmark_tickers JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.ticker_signal_core_forward_returns
ADD COLUMN IF NOT EXISTS benchmark_summaries JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_tscfr_lookup
ON public.ticker_signal_core_forward_returns (
  axis_scope,
  lens,
  provider,
  adjustment_policy,
  as_of_date
);

CREATE INDEX IF NOT EXISTS idx_tscfr_computed_at
ON public.ticker_signal_core_forward_returns (
  computed_at DESC
);
