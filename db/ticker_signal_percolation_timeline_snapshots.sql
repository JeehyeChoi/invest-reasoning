CREATE TABLE IF NOT EXISTS public.ticker_signal_percolation_timeline_snapshots (
  id BIGSERIAL PRIMARY KEY,

  as_of_date DATE NOT NULL,
  snapshot_label TEXT NOT NULL,

  lens TEXT NOT NULL,
  axis_scope TEXT NOT NULL DEFAULT 'all',
  frequency TEXT NOT NULL DEFAULT 'year_end',
  lookback_years INTEGER NOT NULL DEFAULT 10,
  include_latest BOOLEAN NOT NULL DEFAULT true,

  ticker_count INTEGER NOT NULL,
  group_count INTEGER NOT NULL,
  signal_dimension_count INTEGER NOT NULL,

  analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  split_views JSONB NOT NULL DEFAULT '[]'::jsonb,
  baseline_signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  boundary_signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  largest_pieces JSONB NOT NULL DEFAULT '[]'::jsonb,

  source_model_key TEXT NOT NULL DEFAULT 'factor_signal',
  source_model_version TEXT NOT NULL DEFAULT 'v0',

  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_tspts_snapshot UNIQUE (
    as_of_date,
    lens,
    axis_scope,
    frequency,
    lookback_years,
    include_latest,
    source_model_key,
    source_model_version
  ),

  CONSTRAINT chk_tspts_frequency
  CHECK (frequency IN ('year_end', 'year_end_plus_recent_quarters', 'quarter_end')),

  CONSTRAINT chk_tspts_lens
  CHECK (lens IN ('idfWeightedJaccard')),

  CONSTRAINT chk_tspts_axis_scope
  CHECK (
    axis_scope IN (
      'all',
      'fundamentals',
      'valuation',
      'fundamentals_valuation',
      'price_linked',
      'macro_linked'
    )
  ),

  CONSTRAINT chk_tspts_lookback_years_positive
  CHECK (lookback_years > 0),

  CONSTRAINT chk_tspts_counts_nonnegative
  CHECK (
    ticker_count >= 0
    AND group_count >= 0
    AND signal_dimension_count >= 0
  ),

  CONSTRAINT chk_tspts_analysis_object
  CHECK (jsonb_typeof(analysis) = 'object'),

  CONSTRAINT chk_tspts_split_views_array
  CHECK (jsonb_typeof(split_views) = 'array'),

  CONSTRAINT chk_tspts_baseline_array
  CHECK (jsonb_typeof(baseline_signals) = 'array'),

  CONSTRAINT chk_tspts_boundary_array
  CHECK (jsonb_typeof(boundary_signals) = 'array'),

  CONSTRAINT chk_tspts_pieces_array
  CHECK (jsonb_typeof(largest_pieces) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_tspts_lookup
ON public.ticker_signal_percolation_timeline_snapshots (
  lens,
  axis_scope,
  frequency,
  lookback_years,
  include_latest,
  as_of_date
);

CREATE INDEX IF NOT EXISTS idx_tspts_computed_at
ON public.ticker_signal_percolation_timeline_snapshots (
  computed_at DESC
);
