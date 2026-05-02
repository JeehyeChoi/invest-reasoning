CREATE TABLE IF NOT EXISTS public.sec_company_fiscal_metric_sign_profiles (
  cik TEXT NOT NULL,
  ticker TEXT,

  metric_key TEXT NOT NULL,
  tag TEXT NOT NULL,
  unit TEXT NOT NULL,

  sign_profile TEXT NOT NULL,
  expected_sign TEXT NOT NULL,

  sample_count INTEGER NOT NULL DEFAULT 0,
  positive_count INTEGER NOT NULL DEFAULT 0,
  negative_count INTEGER NOT NULL DEFAULT 0,
  zero_count INTEGER NOT NULL DEFAULT 0,

  positive_ratio DOUBLE PRECISION,
  negative_ratio DOUBLE PRECISION,

  first_end DATE,
  latest_end DATE,

  confidence DOUBLE PRECISION NOT NULL DEFAULT 0,
  source_scope TEXT NOT NULL DEFAULT 'raw_direct',

  notes JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT sec_company_fiscal_metric_sign_profiles_pk
    PRIMARY KEY (cik, metric_key, tag, unit),
  CONSTRAINT sec_company_fiscal_metric_sign_profiles_sign_profile_chk
    CHECK (
      sign_profile IN (
        'positive_dominant',
        'negative_dominant',
        'mixed',
        'zero_or_sparse',
        'unknown'
      )
    ),
  CONSTRAINT sec_company_fiscal_metric_sign_profiles_expected_sign_chk
    CHECK (
      expected_sign IN (
        'positive',
        'negative',
        'mixed',
        'unknown'
      )
    ),
  CONSTRAINT sec_company_fiscal_metric_sign_profiles_counts_chk
    CHECK (
      sample_count >= 0
      AND positive_count >= 0
      AND negative_count >= 0
      AND zero_count >= 0
      AND sample_count = positive_count + negative_count + zero_count
    ),
  CONSTRAINT sec_company_fiscal_metric_sign_profiles_ratio_chk
    CHECK (
      (positive_ratio IS NULL OR positive_ratio BETWEEN 0 AND 1)
      AND (negative_ratio IS NULL OR negative_ratio BETWEEN 0 AND 1)
      AND confidence BETWEEN 0 AND 1
    ),
  CONSTRAINT sec_company_fiscal_metric_sign_profiles_scope_chk
    CHECK (
      source_scope IN (
        'raw_direct',
        'raw_direct_10k_10q',
        'raw_direct_and_restated'
      )
    )
);

CREATE INDEX IF NOT EXISTS idx_sec_company_fiscal_metric_sign_profiles_cik_metric
  ON public.sec_company_fiscal_metric_sign_profiles (cik, metric_key);

CREATE INDEX IF NOT EXISTS idx_sec_company_fiscal_metric_sign_profiles_cik_metric_profile
  ON public.sec_company_fiscal_metric_sign_profiles (cik, metric_key, sign_profile);

CREATE INDEX IF NOT EXISTS idx_sec_company_fiscal_metric_sign_profiles_metric_profile
  ON public.sec_company_fiscal_metric_sign_profiles (metric_key, sign_profile);

CREATE INDEX IF NOT EXISTS idx_sec_company_fiscal_metric_sign_profiles_ticker_metric
  ON public.sec_company_fiscal_metric_sign_profiles (ticker, metric_key)
  WHERE ticker IS NOT NULL;

COMMENT ON TABLE public.sec_company_fiscal_metric_sign_profiles IS
'Company-level metric/tag/unit sign convention profile derived from raw SEC observations. Used to guard cumulative and annual reconstruction.';

COMMENT ON COLUMN public.sec_company_fiscal_metric_sign_profiles.sign_profile IS
'Observed raw sign regime for a company metric/tag/unit: positive_dominant, negative_dominant, mixed, zero_or_sparse, or unknown.';

COMMENT ON COLUMN public.sec_company_fiscal_metric_sign_profiles.expected_sign IS
'Normalized expected sign implied by sign_profile for reconstruction guards.';

COMMENT ON COLUMN public.sec_company_fiscal_metric_sign_profiles.source_scope IS
'Input scope used to build the profile. Derived rows should not be used for this profile.';
