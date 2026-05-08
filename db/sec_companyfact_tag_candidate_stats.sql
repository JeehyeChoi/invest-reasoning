CREATE TABLE IF NOT EXISTS public.sec_companyfact_tag_candidate_stats (
  cik             TEXT NOT NULL,
  ticker          TEXT,
  sector          TEXT,
  industry        TEXT,
  taxonomy        TEXT NOT NULL,
  tag             TEXT NOT NULL,
  unit            TEXT NOT NULL,
  fact_type_guess TEXT NOT NULL,
  row_count       INTEGER NOT NULL,
  first_end       DATE,
  last_end        DATE,
  latest_filed    DATE,
  sample_accn     TEXT,
  label           TEXT,
  description     TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT sec_companyfact_tag_candidate_stats_pk
    PRIMARY KEY (cik, taxonomy, tag, unit, fact_type_guess)
);

CREATE INDEX IF NOT EXISTS idx_sec_companyfact_tag_candidate_stats_tag
  ON public.sec_companyfact_tag_candidate_stats (tag);

CREATE INDEX IF NOT EXISTS idx_sec_companyfact_tag_candidate_stats_sector
  ON public.sec_companyfact_tag_candidate_stats (sector, industry, tag);

CREATE INDEX IF NOT EXISTS idx_sec_companyfact_tag_candidate_stats_ticker
  ON public.sec_companyfact_tag_candidate_stats (ticker, tag);

COMMENT ON TABLE public.sec_companyfact_tag_candidate_stats IS
'Per-CIK SEC companyfacts unmapped tag candidate statistics collected while raw rows are staged during bulk ingest.';
