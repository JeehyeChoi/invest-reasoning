CREATE TABLE IF NOT EXISTS public.sec_companyfact_metric_series_experiment (
  id              BIGSERIAL PRIMARY KEY,

  cik             TEXT NOT NULL,
  ticker          TEXT,

  metric_key      TEXT NOT NULL,
  source_tag      TEXT,
  fact_type       TEXT NOT NULL,
  unit            TEXT NOT NULL,
  val             DOUBLE PRECISION NOT NULL,

  start           DATE,
  "end"           DATE NOT NULL,
  filed           DATE,
  effective_date  DATE NOT NULL,
  accn            TEXT,

  fy              INTEGER,
  fp              TEXT,
  form            TEXT,
  frame           TEXT,

  duration_days   INTEGER,

  fiscal_year     INTEGER,
  fiscal_quarter  INTEGER,
  period_type     TEXT NOT NULL,

  build_source_kind TEXT,
  workflow_type   TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT sec_companyfact_metric_series_experiment_fact_type_chk
    CHECK (fact_type IN ('flow', 'instant', 'per_share', 'share_count')),

  CONSTRAINT sec_companyfact_metric_series_experiment_period_type_chk
    CHECK (period_type IN ('instant', 'quarter', 'ytd', 'annual', 'other')),

  CONSTRAINT sec_companyfact_metric_series_experiment_fiscal_quarter_chk
    CHECK (fiscal_quarter IS NULL OR fiscal_quarter IN (1, 2, 3, 4)),

  CONSTRAINT sec_companyfact_metric_series_experiment_build_source_kind_chk
    CHECK (
      build_source_kind IS NULL
      OR build_source_kind IN (
        'raw_direct',
        'raw_partial',
        'segment_merged',
        'other_merged',
        'cumulative_derived',
        'annual_derived'
      )
    ),

  CONSTRAINT sec_companyfact_metric_series_experiment_unique_point
    UNIQUE (cik, metric_key, unit, period_type, start, "end")
);

CREATE INDEX IF NOT EXISTS idx_metric_series_experiment_cik_metric_period_end
  ON public.sec_companyfact_metric_series_experiment (cik, metric_key, period_type, "end");

CREATE INDEX IF NOT EXISTS idx_metric_series_experiment_effective
  ON public.sec_companyfact_metric_series_experiment (effective_date DESC);

CREATE INDEX IF NOT EXISTS idx_metric_series_experiment_cik_metric_source_tag
  ON public.sec_companyfact_metric_series_experiment (cik, metric_key, source_tag, unit);

CREATE INDEX IF NOT EXISTS idx_metric_series_experiment_ticker_metric_period_end
  ON public.sec_companyfact_metric_series_experiment (ticker, metric_key, period_type, "end");

CREATE INDEX IF NOT EXISTS idx_metric_series_experiment_cik_metric_fiscal
  ON public.sec_companyfact_metric_series_experiment (cik, metric_key, fiscal_year, fiscal_quarter);

CREATE INDEX IF NOT EXISTS idx_metric_series_experiment_cik_metric_frame
  ON public.sec_companyfact_metric_series_experiment (cik, metric_key, frame);

CREATE INDEX IF NOT EXISTS idx_metric_series_experiment_cik_metric_source
  ON public.sec_companyfact_metric_series_experiment (cik, metric_key, build_source_kind, "end");

COMMENT ON TABLE public.sec_companyfact_metric_series_experiment IS
'Experimental SEC companyfacts metric series built from candidate tag policies. This table is intentionally separate from baseline metric series.';

COMMENT ON COLUMN public.sec_companyfact_metric_series_experiment.workflow_type IS
'Experiment run label, for example tag_experiment:instant_candidates_v1.';
