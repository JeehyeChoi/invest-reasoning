CREATE TABLE IF NOT EXISTS public.provider_api_usage_events (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  status_code INTEGER,
  response_bytes INTEGER NOT NULL CHECK (response_bytes >= 0),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_provider_api_usage_events_provider_requested_at
  ON public.provider_api_usage_events (provider, requested_at DESC);
