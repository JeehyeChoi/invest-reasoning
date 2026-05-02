CREATE TABLE IF NOT EXISTS public.ticker_factor_metric_clusters (
  id BIGSERIAL PRIMARY KEY,

  run_id TEXT NOT NULL,
  ticker TEXT NOT NULL,

  factor TEXT NOT NULL,
  axis TEXT NOT NULL,
  comparison_set_type TEXT NOT NULL,
  comparison_set_key TEXT NOT NULL,

  cluster_method TEXT NOT NULL,
  normalization_method TEXT NOT NULL,

  cluster_id INTEGER NOT NULL,
  cluster_label TEXT,
  cluster_size INTEGER,
  is_outlier BOOLEAN NOT NULL DEFAULT FALSE,

  feature_count INTEGER NOT NULL,
  observed_feature_count INTEGER NOT NULL,
  missing_feature_count INTEGER NOT NULL,
  coverage_ratio DOUBLE PRECISION NOT NULL,
  distance_to_centroid DOUBLE PRECISION,

  vector_effective_date DATE NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_ticker_factor_metric_clusters UNIQUE (
    run_id,
    ticker
  ),

  CONSTRAINT chk_tfmcl_feature_count_positive
  CHECK (feature_count > 0),

  CONSTRAINT chk_tfmcl_observed_feature_count_nonnegative
  CHECK (observed_feature_count >= 0),

  CONSTRAINT chk_tfmcl_missing_feature_count_nonnegative
  CHECK (missing_feature_count >= 0),

  CONSTRAINT chk_tfmcl_coverage_ratio_range
  CHECK (coverage_ratio >= 0 AND coverage_ratio <= 1)
);

CREATE INDEX IF NOT EXISTS idx_tfmcl_run_cluster
ON public.ticker_factor_metric_clusters (
  run_id,
  cluster_id,
  ticker
);

CREATE INDEX IF NOT EXISTS idx_tfmcl_ticker
ON public.ticker_factor_metric_clusters (
  ticker,
  computed_at DESC
);

CREATE INDEX IF NOT EXISTS idx_tfmcl_scope
ON public.ticker_factor_metric_clusters (
  factor,
  axis,
  comparison_set_type,
  comparison_set_key,
  vector_effective_date DESC
);

CREATE TABLE IF NOT EXISTS public.ticker_factor_metric_cluster_profiles (
  id BIGSERIAL PRIMARY KEY,

  run_id TEXT NOT NULL,
  cluster_id INTEGER NOT NULL,

  factor TEXT NOT NULL,
  axis TEXT NOT NULL,
  comparison_set_type TEXT NOT NULL,
  comparison_set_key TEXT NOT NULL,

  cluster_method TEXT NOT NULL,
  normalization_method TEXT NOT NULL,

  cluster_label TEXT,
  cluster_size INTEGER NOT NULL,
  feature_count INTEGER NOT NULL,
  average_coverage_ratio DOUBLE PRECISION NOT NULL,
  average_distance_to_centroid DOUBLE PRECISION,

  distinguishing_features JSONB NOT NULL DEFAULT '[]'::jsonb,
  centroid JSONB NOT NULL DEFAULT '{}'::jsonb,

  vector_effective_date DATE NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_ticker_factor_metric_cluster_profiles UNIQUE (
    run_id,
    cluster_id
  ),

  CONSTRAINT chk_tfmcp_cluster_size_positive
  CHECK (cluster_size > 0),

  CONSTRAINT chk_tfmcp_feature_count_positive
  CHECK (feature_count > 0),

  CONSTRAINT chk_tfmcp_average_coverage_ratio_range
  CHECK (average_coverage_ratio >= 0 AND average_coverage_ratio <= 1)
);

CREATE INDEX IF NOT EXISTS idx_tfmcp_run_cluster
ON public.ticker_factor_metric_cluster_profiles (
  run_id,
  cluster_id
);
