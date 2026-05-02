CREATE TABLE IF NOT EXISTS sec_companyfact_metric_series_enriched (
  id BIGSERIAL PRIMARY KEY,

  cik TEXT NOT NULL,
  ticker TEXT,

  metric_key TEXT NOT NULL,
  fact_type TEXT NOT NULL,
  unit TEXT NOT NULL,

  val DOUBLE PRECISION NOT NULL,

  start DATE,
  "end" DATE NOT NULL,

  fiscal_year INTEGER,
  fiscal_quarter INTEGER,
  period_type TEXT NOT NULL,
  duration_days INTEGER,

  -- growth / momentum
  yoy DOUBLE PRECISION,
  qoq DOUBLE PRECISION,
  yoy_delta DOUBLE PRECISION,

  -- smoothing / scale
  ttm_val DOUBLE PRECISION,
  ttm_yoy DOUBLE PRECISION,
  ttm_delta DOUBLE PRECISION,
  rolling4_avg DOUBLE PRECISION,

  -- duration-normalized values for 52/53-week and uneven-quarter companies
  duration_adjusted_val DOUBLE PRECISION,
  duration_adjusted_yoy DOUBLE PRECISION,
  duration_adjusted_qoq DOUBLE PRECISION,
  duration_adjusted_yoy_delta DOUBLE PRECISION,
  duration_adjusted_ttm_val DOUBLE PRECISION,
  duration_adjusted_ttm_yoy DOUBLE PRECISION,
  duration_adjusted_ttm_delta DOUBLE PRECISION,
  duration_adjusted_rolling4_avg DOUBLE PRECISION,

  -- calculation provenance / debugging
  yoy_source_kind TEXT,
  yoy_base_period_end DATE,
  qoq_source_kind TEXT,
  qoq_base_period_end DATE,
  ttm_source_kind TEXT,
  ttm_window_start DATE,
  ttm_window_end DATE,
  ttm_yoy_source_kind TEXT,
  ttm_yoy_base_window_start DATE,
  ttm_yoy_base_window_end DATE,

  -- interpreted flags
  is_turnaround BOOLEAN,
  is_deterioration BOOLEAN,
  is_loss_narrowing BOOLEAN,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (
    cik,
    metric_key,
    fact_type,
    unit,
    period_type,
    start,
    "end"
  )
);

-- 1️⃣ 차트 / API 핵심 조회 (가장 중요)
CREATE INDEX IF NOT EXISTS idx_enriched_ticker_metric_end
ON sec_companyfact_metric_series_enriched (ticker, metric_key, "end" DESC);

-- 2️⃣ 내부 계산 / 정확 기준 조회
CREATE INDEX IF NOT EXISTS idx_enriched_cik_metric_end
ON sec_companyfact_metric_series_enriched (cik, metric_key, "end" DESC);

-- 3️⃣ 최신 값 빠르게 가져오기 (quarter / annual 분리)
CREATE INDEX IF NOT EXISTS idx_enriched_latest
ON sec_companyfact_metric_series_enriched (ticker, metric_key, period_type, "end" DESC);

-- Batch processing (metric-level)
CREATE INDEX IF NOT EXISTS idx_enriched_metric_period_end
ON sec_companyfact_metric_series_enriched (metric_key, period_type, "end" DESC);

-- 5️⃣ fiscal 기반 검증/정렬
CREATE INDEX IF NOT EXISTS idx_enriched_fiscal
ON sec_companyfact_metric_series_enriched (
  ticker,
  metric_key,
  fiscal_year DESC,
  fiscal_quarter DESC
);

-- 6️⃣ fact/unit ambiguity 방지
CREATE INDEX IF NOT EXISTS idx_enriched_fact_unit
ON sec_companyfact_metric_series_enriched (metric_key, fact_type, unit);
