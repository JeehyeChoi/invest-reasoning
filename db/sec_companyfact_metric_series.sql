CREATE TABLE IF NOT EXISTS public.sec_companyfact_metric_series (
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

  CONSTRAINT sec_companyfact_metric_series_fact_type_chk
    CHECK (fact_type IN ('flow', 'instant', 'per_share', 'share_count')),

  CONSTRAINT sec_companyfact_metric_series_period_type_chk
    CHECK (period_type IN ('instant', 'quarter', 'ytd', 'annual', 'other')),

  CONSTRAINT sec_companyfact_metric_series_fiscal_quarter_chk
    CHECK (fiscal_quarter IS NULL OR fiscal_quarter IN (1, 2, 3, 4)),

  CONSTRAINT sec_companyfact_metric_series_build_source_kind_chk
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

  CONSTRAINT sec_companyfact_metric_series_unique_point
    UNIQUE (cik, metric_key, unit, period_type, start, "end")
);

CREATE INDEX IF NOT EXISTS idx_metric_series_cik_metric_period_end
  ON public.sec_companyfact_metric_series (cik, metric_key, period_type, "end");

CREATE INDEX IF NOT EXISTS idx_metric_series_cik_metric_source_tag
  ON public.sec_companyfact_metric_series (cik, metric_key, source_tag, unit);

CREATE INDEX IF NOT EXISTS idx_metric_series_ticker_metric_period_end
  ON public.sec_companyfact_metric_series (ticker, metric_key, period_type, "end");

CREATE INDEX IF NOT EXISTS idx_metric_series_cik_metric_fiscal
  ON public.sec_companyfact_metric_series (cik, metric_key, fiscal_year, fiscal_quarter);

CREATE INDEX IF NOT EXISTS idx_metric_series_cik_metric_frame
  ON public.sec_companyfact_metric_series (cik, metric_key, frame);

CREATE INDEX IF NOT EXISTS idx_metric_series_cik_metric_source
  ON public.sec_companyfact_metric_series (cik, metric_key, build_source_kind, "end");

COMMENT ON COLUMN public.sec_companyfact_metric_series.build_source_kind IS
'Normalized provenance of the metric point: direct SEC fact, partial segment, merged segment, merged other flow, cumulative-derived quarter, or annual-derived quarter';

COMMENT ON COLUMN public.sec_companyfact_metric_series.source_tag IS
'SEC source tag used to build the metric point. Required for tag-level sign profile diagnostics.';
