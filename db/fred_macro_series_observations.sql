CREATE TABLE IF NOT EXISTS public.fred_macro_series_observations (
  id BIGSERIAL PRIMARY KEY,

  series_id TEXT NOT NULL,
  observation_date DATE NOT NULL,

  value DOUBLE PRECISION,
  units TEXT NOT NULL,
  frequency TEXT NOT NULL,

  realtime_start DATE,
  realtime_end DATE,

  source TEXT NOT NULL DEFAULT 'fred',
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_fred_macro_series_observations UNIQUE (
    series_id,
    units,
    observation_date
  )
);

CREATE INDEX IF NOT EXISTS idx_fred_macro_observations_lookup
ON public.fred_macro_series_observations (
  series_id,
  units,
  observation_date DESC
);

CREATE INDEX IF NOT EXISTS idx_fred_macro_observations_date
ON public.fred_macro_series_observations (observation_date DESC);
