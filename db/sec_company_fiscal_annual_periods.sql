CREATE TABLE IF NOT EXISTS public.sec_company_fiscal_annual_periods (
  cik TEXT NOT NULL,
  fiscal_year INTEGER NOT NULL,
  start DATE NOT NULL,
  "end" DATE NOT NULL,
  duration_days INTEGER,
  source_kind TEXT NOT NULL,
  is_transition BOOLEAN NOT NULL DEFAULT FALSE,
  is_anchor BOOLEAN NOT NULL DEFAULT FALSE,
  source_accn TEXT,
  source_filed DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT sec_company_fiscal_annual_periods_pk
    PRIMARY KEY (cik, fiscal_year, start, "end"),
  CONSTRAINT sec_company_fiscal_annual_periods_source_kind_chk
    CHECK (
      source_kind IN (
        'annual_report',
        'annual_report_transition',
        'derived_from_quarters'
      )
    )
);

CREATE INDEX IF NOT EXISTS idx_sec_company_fiscal_annual_periods_lookup
  ON public.sec_company_fiscal_annual_periods (cik, fiscal_year, "end");
