CREATE TABLE IF NOT EXISTS public.sec_company_fiscal_quarter_periods (
  cik TEXT NOT NULL,
  fiscal_year INTEGER NOT NULL,
  fiscal_quarter INTEGER NOT NULL,
  start DATE NOT NULL,
  "end" DATE NOT NULL,
  duration_days INTEGER NOT NULL,
  source_kind TEXT NOT NULL,
  source_accn TEXT,
  source_filed DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT sec_company_fiscal_quarter_periods_pk
    PRIMARY KEY (cik, fiscal_year, fiscal_quarter, start, "end"),
  CONSTRAINT sec_company_fiscal_quarter_periods_fq_chk
    CHECK (fiscal_quarter IN (1, 2, 3, 4)),
  CONSTRAINT sec_company_fiscal_quarter_periods_source_kind_chk
    CHECK (
      source_kind IN (
        'direct',
        'cumulative_derived',
        'annual_derived'
      )
    )
);

CREATE INDEX IF NOT EXISTS idx_sec_company_fiscal_quarter_periods_lookup
  ON public.sec_company_fiscal_quarter_periods (cik, fiscal_year, fiscal_quarter, "end");
