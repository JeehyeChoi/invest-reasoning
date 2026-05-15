CREATE TABLE IF NOT EXISTS public.ticker_signal_clustering_question_policies (
  id BIGSERIAL PRIMARY KEY,

  model_key TEXT NOT NULL DEFAULT 'factor_signal',
  model_version TEXT NOT NULL DEFAULT 'v0',

  factor TEXT NOT NULL,
  axis TEXT NOT NULL,

  status TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'manual',
  validation_payload JSONB NOT NULL DEFAULT '{}'::jsonb,

  refreshed_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_tscqp UNIQUE (
    model_key,
    model_version,
    factor,
    axis
  ),

  CONSTRAINT chk_tscqp_status
  CHECK (status IN ('use', 'review', 'hold')),

  CONSTRAINT chk_tscqp_validation_payload_object
  CHECK (jsonb_typeof(validation_payload) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_tscqp_active_lookup
ON public.ticker_signal_clustering_question_policies (
  factor,
  axis,
  status,
  is_active
);

INSERT INTO public.ticker_signal_clustering_question_policies (
  model_key,
  model_version,
  factor,
  axis,
  status,
  reason,
  source,
  validation_payload,
  is_active
)
VALUES
  (
    'factor_signal',
    'v0',
    'china_exposure',
    'etf_exposure',
    'hold',
    'No signal coverage yet; keep out of market-level clustering until ETF exposure data is populated.',
    'manual',
    '{}'::jsonb,
    true
  ),
  (
    'factor_signal',
    'v0',
    'energy_linked',
    'fundamentals_based',
    'hold',
    'Energy fundamentals coverage is too sparse for broad-universe clustering; use as sector/theme detail until coverage improves.',
    'manual',
    '{}'::jsonb,
    true
  ),
  (
    'factor_signal',
    'v0',
    'growth',
    'valuation',
    'review',
    'Valuation coverage is incomplete; review after derived valuation and price coverage are refreshed.',
    'manual',
    '{}'::jsonb,
    true
  ),
  (
    'factor_signal',
    'v0',
    'income',
    'valuation',
    'review',
    'Valuation coverage is incomplete; review after derived valuation and price coverage are refreshed.',
    'manual',
    '{}'::jsonb,
    true
  ),
  (
    'factor_signal',
    'v0',
    'value',
    'valuation',
    'review',
    'Valuation coverage is incomplete; review after derived valuation and price coverage are refreshed.',
    'manual',
    '{}'::jsonb,
    true
  )
ON CONFLICT (model_key, model_version, factor, axis)
DO UPDATE SET
  status = EXCLUDED.status,
  reason = EXCLUDED.reason,
  source = EXCLUDED.source,
  validation_payload = EXCLUDED.validation_payload,
  is_active = EXCLUDED.is_active,
  updated_at = now();
