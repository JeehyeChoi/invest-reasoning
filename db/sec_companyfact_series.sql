CREATE TABLE public.sec_companyfact_series (
  id            BIGSERIAL PRIMARY KEY,

  cik           TEXT NOT NULL,
  ticker        TEXT,

  metric_key    TEXT NOT NULL,
  fact_type     TEXT NOT NULL,
  unit          TEXT NOT NULL,
  val           DOUBLE PRECISION NOT NULL,

  start         DATE,
  "end"         DATE NOT NULL,
  filed         DATE,
  accn          TEXT,
  fy            INTEGER,
  fp            TEXT,
  form          TEXT,

  display_frame TEXT,
  period_type   TEXT NOT NULL,

  workflow_type TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT sec_companyfact_series_fact_type_chk
    CHECK (fact_type IN ('flow', 'instant', 'per_share', 'share_count')),

  CONSTRAINT sec_companyfact_series_period_type_chk
    CHECK (
      period_type IN (
        'instant',
        'quarterly',
        'annual',
        'other'
      )
    ),

	CONSTRAINT sec_companyfact_series_unique_point
  	UNIQUE (cik, metric_key, period_type, display_frame)
);

CREATE INDEX idx_sec_companyfact_series_cik_metric_period_end
  ON public.sec_companyfact_series (cik, metric_key, period_type, "end");

CREATE INDEX idx_sec_companyfact_series_ticker_metric_period_end
  ON public.sec_companyfact_series (ticker, metric_key, period_type, "end");

CREATE INDEX idx_sec_companyfact_series_cik_metric_period_display_frame
  ON public.sec_companyfact_series (cik, metric_key, period_type, display_frame);

CREATE INDEX idx_sec_companyfact_series_period_type
  ON public.sec_companyfact_series (period_type);

CREATE INDEX idx_sec_companyfact_series_filed
  ON public.sec_companyfact_series (filed);

CREATE INDEX idx_sec_companyfact_series_end
  ON public.sec_companyfact_series ("end");
