CREATE TABLE IF NOT EXISTS public.expectation_assumption_sets (
  assumption_set_key TEXT PRIMARY KEY,

  name TEXT NOT NULL,
  description TEXT,

  horizon_years INTEGER NOT NULL,
  discount_rate DOUBLE PRECISION NOT NULL,
  terminal_ev_sales_multiple DOUBLE PRECISION,
  terminal_pe_multiple DOUBLE PRECISION,
  terminal_operating_margin DOUBLE PRECISION,

  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_eas_horizon_positive
  CHECK (horizon_years > 0),

  CONSTRAINT chk_eas_discount_rate_range
  CHECK (discount_rate > -1 AND discount_rate < 1),

  CONSTRAINT chk_eas_terminal_ev_sales_positive
  CHECK (
    terminal_ev_sales_multiple IS NULL
    OR terminal_ev_sales_multiple > 0
  ),

  CONSTRAINT chk_eas_terminal_pe_positive
  CHECK (
    terminal_pe_multiple IS NULL
    OR terminal_pe_multiple > 0
  )
);

CREATE INDEX IF NOT EXISTS idx_expectation_assumption_sets_active
ON public.expectation_assumption_sets (is_active, display_order, assumption_set_key);

INSERT INTO public.expectation_assumption_sets (
  assumption_set_key,
  name,
  description,
  horizon_years,
  discount_rate,
  terminal_ev_sales_multiple,
  terminal_pe_multiple,
  terminal_operating_margin,
  is_active,
  display_order
)
VALUES
  (
    'conservative_5y',
    'Conservative 5Y',
    'Higher discount rate and lower terminal multiples for a stricter implied expectation path.',
    5,
    0.12,
    4,
    18,
    0.15,
    TRUE,
    10
  ),
  (
    'base_5y',
    'Base 5Y',
    'Middle assumption set for broad cross-ticker implied financial expectation comparisons.',
    5,
    0.10,
    8,
    25,
    0.25,
    TRUE,
    20
  ),
  (
    'growth_5y',
    'Growth 5Y',
    'Lower discount rate and higher terminal multiples for higher-quality or faster-growth expectation paths.',
    5,
    0.08,
    12,
    35,
    0.35,
    TRUE,
    30
  )
ON CONFLICT (assumption_set_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  horizon_years = EXCLUDED.horizon_years,
  discount_rate = EXCLUDED.discount_rate,
  terminal_ev_sales_multiple = EXCLUDED.terminal_ev_sales_multiple,
  terminal_pe_multiple = EXCLUDED.terminal_pe_multiple,
  terminal_operating_margin = EXCLUDED.terminal_operating_margin,
  is_active = EXCLUDED.is_active,
  display_order = EXCLUDED.display_order,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.ticker_implied_financial_expectations (
  id BIGSERIAL PRIMARY KEY,

  ticker TEXT NOT NULL,
  cik TEXT,
  assumption_set_key TEXT NOT NULL
    REFERENCES public.expectation_assumption_sets(assumption_set_key),

  as_of_date DATE NOT NULL,
  source_version TEXT NOT NULL,

  current_price DOUBLE PRECISION,
  current_market_cap DOUBLE PRECISION,
  current_enterprise_value DOUBLE PRECISION,
  current_revenue_ttm DOUBLE PRECISION,
  current_operating_income_ttm DOUBLE PRECISION,
  current_net_income_ttm DOUBLE PRECISION,
  current_eps_ttm DOUBLE PRECISION,
  current_shares_outstanding DOUBLE PRECISION,
  current_operating_margin DOUBLE PRECISION,
  current_net_margin DOUBLE PRECISION,
  current_ev_sales_multiple DOUBLE PRECISION,
  current_pe_multiple DOUBLE PRECISION,

  horizon_years INTEGER NOT NULL,
  discount_rate DOUBLE PRECISION NOT NULL,
  terminal_ev_sales_multiple DOUBLE PRECISION,
  terminal_pe_multiple DOUBLE PRECISION,
  terminal_operating_margin DOUBLE PRECISION,

  implied_terminal_enterprise_value DOUBLE PRECISION,
  implied_terminal_equity_value DOUBLE PRECISION,
  implied_revenue_terminal DOUBLE PRECISION,
  implied_revenue_cagr DOUBLE PRECISION,
  implied_operating_income_terminal DOUBLE PRECISION,
  implied_net_income_terminal DOUBLE PRECISION,
  implied_net_income_cagr DOUBLE PRECISION,
  implied_eps_terminal DOUBLE PRECISION,
  implied_eps_cagr DOUBLE PRECISION,

  expectation_burden_score DOUBLE PRECISION,
  valuation_fragility_score DOUBLE PRECISION,

  source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_ticker_implied_financial_expectations UNIQUE (
    ticker,
    assumption_set_key,
    as_of_date,
    source_version
  ),

  CONSTRAINT chk_tife_horizon_positive
  CHECK (horizon_years > 0),

  CONSTRAINT chk_tife_expectation_burden_range
  CHECK (
    expectation_burden_score IS NULL
    OR (expectation_burden_score >= 0 AND expectation_burden_score <= 1)
  ),

  CONSTRAINT chk_tife_valuation_fragility_range
  CHECK (
    valuation_fragility_score IS NULL
    OR (valuation_fragility_score >= 0 AND valuation_fragility_score <= 1)
  ),

  CONSTRAINT chk_tife_source_payload_object
  CHECK (jsonb_typeof(source_payload) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_tife_ticker_asof
ON public.ticker_implied_financial_expectations (
  ticker,
  as_of_date DESC,
  assumption_set_key
);

CREATE INDEX IF NOT EXISTS idx_tife_assumption_asof
ON public.ticker_implied_financial_expectations (
  assumption_set_key,
  as_of_date DESC,
  ticker
);

CREATE INDEX IF NOT EXISTS idx_tife_burden
ON public.ticker_implied_financial_expectations (
  assumption_set_key,
  expectation_burden_score DESC,
  as_of_date DESC
);
