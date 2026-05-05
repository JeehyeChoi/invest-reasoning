CREATE TABLE IF NOT EXISTS public.ticker_factor_signals (
  id BIGSERIAL PRIMARY KEY,

  ticker TEXT NOT NULL,
  cik TEXT,

  factor TEXT NOT NULL,
  axis TEXT NOT NULL,

  model_key TEXT NOT NULL DEFAULT 'factor_signal',
  model_version TEXT NOT NULL DEFAULT 'v0',

  signal_key TEXT NOT NULL,
  signal_label TEXT,
  signal_value DOUBLE PRECISION,
  signal_method TEXT NOT NULL,
  signal_confidence DOUBLE PRECISION,

  signal_period_end DATE NOT NULL,
  signal_effective_date DATE NOT NULL,

  latest_growth_value DOUBLE PRECISION,
  durable_growth_value DOUBLE PRECISION,
  consistency_value DOUBLE PRECISION,
  acceleration_value DOUBLE PRECISION,
  trend_deviation_value DOUBLE PRECISION,
  turnaround_momentum_value DOUBLE PRECISION,
  shock_absorption_value DOUBLE PRECISION,

  primary_metric_key TEXT,
  primary_feature_key TEXT,
  primary_feature_value DOUBLE PRECISION,

  observed_metric_count INTEGER,
  total_metric_count INTEGER,
  feature_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  supporting_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  contradicting_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,

  source_table TEXT,
  source_version TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_ticker_factor_signals UNIQUE (
    ticker,
    factor,
    axis,
    model_key,
    model_version,
    signal_effective_date
  ),

  CONSTRAINT chk_tfs_consistency_range
  CHECK (consistency_value IS NULL OR (consistency_value >= 0 AND consistency_value <= 1)),

  CONSTRAINT chk_tfs_signal_confidence_range
  CHECK (signal_confidence IS NULL OR (signal_confidence >= 0 AND signal_confidence <= 1)),

  CONSTRAINT chk_tfs_feature_values_object
  CHECK (jsonb_typeof(feature_values) = 'object'),

  CONSTRAINT chk_tfs_supporting_evidence_array
  CHECK (jsonb_typeof(supporting_evidence) = 'array'),

  CONSTRAINT chk_tfs_contradicting_evidence_array
  CHECK (jsonb_typeof(contradicting_evidence) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_tfs_lookup
ON public.ticker_factor_signals (
  ticker,
  factor,
  axis,
  signal_effective_date DESC
);

CREATE INDEX IF NOT EXISTS idx_tfs_signal
ON public.ticker_factor_signals (
  factor,
  axis,
  signal_key,
  signal_effective_date DESC
);

CREATE INDEX IF NOT EXISTS idx_tfs_primary_feature
ON public.ticker_factor_signals (
  factor,
  axis,
  primary_metric_key,
  primary_feature_key
);
