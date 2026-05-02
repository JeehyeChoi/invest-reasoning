CREATE TABLE IF NOT EXISTS public.sec_companyfact_tag_series (
  id            BIGSERIAL PRIMARY KEY,

  cik           TEXT NOT NULL,
  ticker        TEXT,

  tag           TEXT NOT NULL,
  metric_key    TEXT NOT NULL,
  priority      INTEGER,

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
  frame         TEXT,

  -- 🔥 mechanical 정보 (period_type 대신)
  duration_days INTEGER,

  workflow_type TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT sec_companyfact_tag_series_fact_type_chk
    CHECK (fact_type IN ('flow', 'instant', 'per_share', 'share_count')),

  -- 🔥 tag 기준 unique (raw provenance 유지)
  CONSTRAINT sec_companyfact_tag_series_unique_point
    UNIQUE (
      cik,
      tag,
      metric_key,
      unit,
      start,
      "end",
      filed,
      accn,
      fy,
      fp,
      form,
      val
    )
);

CREATE INDEX IF NOT EXISTS idx_tag_series_cik_tag_end
  ON public.sec_companyfact_tag_series (cik, tag, "end");

CREATE INDEX IF NOT EXISTS idx_tag_series_cik_metric_end
  ON public.sec_companyfact_tag_series (cik, metric_key, "end");

CREATE INDEX IF NOT EXISTS idx_tag_series_metric_priority
  ON public.sec_companyfact_tag_series (metric_key, priority);

-- 🔥 duration 기반 조회용 (중요)
CREATE INDEX IF NOT EXISTS idx_tag_series_cik_metric_duration_end
  ON public.sec_companyfact_tag_series (cik, metric_key, duration_days, "end");
