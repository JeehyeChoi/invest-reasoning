CREATE TABLE IF NOT EXISTS public.sec_company_fiscal_profiles (
  cik TEXT PRIMARY KEY,
  ticker TEXT,

  earliest_fiscal_year INTEGER,
  latest_fiscal_year INTEGER,
  latest_annual_start DATE,
  latest_annual_end DATE,

  fiscal_year_end_month INTEGER,
  fiscal_year_end_day INTEGER,
  fiscal_year_end_weekday INTEGER,

  current_fiscal_regime_type TEXT,
  current_fiscal_regime_start_fiscal_year INTEGER,
  current_fiscal_regime_end_fiscal_year INTEGER,
  is_week_based_fiscal_year BOOLEAN NOT NULL DEFAULT FALSE,
  has_53_week_fiscal_year BOOLEAN NOT NULL DEFAULT FALSE,

  fiscal_year_end_history JSONB,

  annual_duration_days INTEGER,

  q1_duration_min INTEGER,
  q1_duration_max INTEGER,
  q1_duration_mode INTEGER,
  q1_sample_count INTEGER,
  q2_duration_min INTEGER,
  q2_duration_max INTEGER,
  q2_duration_mode INTEGER,
  q2_sample_count INTEGER,
  q3_duration_min INTEGER,
  q3_duration_max INTEGER,
  q3_duration_mode INTEGER,
  q3_sample_count INTEGER,
  q4_duration_min INTEGER,
  q4_duration_max INTEGER,
  q4_duration_mode INTEGER,
  q4_sample_count INTEGER,

  quarter_duration_profile JSONB,

  source_accn TEXT,
  source_filed DATE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT sec_company_fiscal_profiles_fye_month_chk
    CHECK (fiscal_year_end_month IS NULL OR fiscal_year_end_month BETWEEN 1 AND 12),
  CONSTRAINT sec_company_fiscal_profiles_fye_day_chk
    CHECK (fiscal_year_end_day IS NULL OR fiscal_year_end_day BETWEEN 1 AND 31),
  CONSTRAINT sec_company_fiscal_profiles_fye_weekday_chk
    CHECK (fiscal_year_end_weekday IS NULL OR fiscal_year_end_weekday BETWEEN 0 AND 6),
  CONSTRAINT sec_company_fiscal_profiles_regime_type_chk
    CHECK (
      current_fiscal_regime_type IS NULL
      OR current_fiscal_regime_type IN (
        'calendar_month_end',
        'fiscal_month_end',
        'week_52_53',
        'transition'
      )
    )
);

CREATE INDEX IF NOT EXISTS idx_sec_company_fiscal_profiles_ticker
  ON public.sec_company_fiscal_profiles (ticker);

CREATE INDEX IF NOT EXISTS idx_sec_company_fiscal_profiles_regime
  ON public.sec_company_fiscal_profiles (
    current_fiscal_regime_type,
    is_week_based_fiscal_year,
    has_53_week_fiscal_year
  );

COMMENT ON TABLE public.sec_company_fiscal_profiles IS
'Company-level fiscal summary profile derived from SEC raw data. Exact annual and quarter periods are stored in detail tables.';

COMMENT ON COLUMN public.sec_company_fiscal_profiles.fiscal_year_end_history IS
'Summary-only historical regime history without embedded annual period rows.';

COMMENT ON COLUMN public.sec_company_fiscal_profiles.quarter_duration_profile IS
'Quarter duration distribution summary with outlier metadata only.';
