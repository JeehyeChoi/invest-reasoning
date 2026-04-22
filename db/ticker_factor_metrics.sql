CREATE TABLE IF NOT EXISTS ticker_factor_metrics (
  id BIGSERIAL PRIMARY KEY,

  -- entity
  ticker TEXT NOT NULL,
  cik TEXT,

  -- factor identity
  factor TEXT NOT NULL,
  axis TEXT NOT NULL,
  metric_key TEXT NOT NULL,
  model TEXT NOT NULL,

  -- timing
  effective_date DATE,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- result
  score DOUBLE PRECISION,
  metrics JSONB NOT NULL,

  -- trace/debug
  source_point_count INTEGER,
  source_window_end DATE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT ticker_factor_metrics_factor_chk
    CHECK (factor IN (
      'consumer_strength',
      'capex_cycle',
      'rate_sensitive',
      'energy_linked',
      'china_exposure',
      'quality',
      'income',
      'size',
      'momentum',
      'high_beta',
      'low_volatility',
      'defensive',
      'duration_sensitive',
      'liquidity_sensitive',
      'inflation_hedge',
      'commodity_linked',
      'reshoring_defense',
      'growth',
      'value',
      'cyclical'
    )),

  CONSTRAINT ticker_factor_metrics_axis_chk
    CHECK (axis IN (
      'fundamentals_based',
      'etf_implied',
      'narrative_implied'
    )),

  CONSTRAINT ticker_factor_metrics_model_chk
    CHECK (model IN (
      'heuristic',
      'quantitative',
      'modeling'
    )),

  CONSTRAINT ticker_factor_metrics_unique_snapshot
    UNIQUE (
      ticker,
      factor,
      axis,
      metric_key,
      model,
      effective_date
    )
);

CREATE INDEX IF NOT EXISTS idx_ticker_factor_metrics_ticker
  ON ticker_factor_metrics (ticker);

CREATE INDEX IF NOT EXISTS idx_ticker_factor_metrics_factor_axis_metric
  ON ticker_factor_metrics (factor, axis, metric_key);

CREATE INDEX IF NOT EXISTS idx_ticker_factor_metrics_effective_date
  ON ticker_factor_metrics (effective_date);

CREATE INDEX IF NOT EXISTS idx_ticker_factor_metrics_computed_at
  ON ticker_factor_metrics (computed_at);

CREATE INDEX IF NOT EXISTS idx_ticker_factor_metrics_score
  ON ticker_factor_metrics (score);
