-- ticker_factor_score_snapshots.sql
-- Stores time-based factor scores for each ticker by factor and evidence axis.
-- This is the core observational table for the factor layer.
--
-- Design notes:
-- 1) One row = one ticker x factor x axis x snapshot_date
-- 2) Axis values come from factor_score_axis_definitions
-- 3) Scores are observational/derived outputs, not master definitions
-- 4) tag-factor relationships should be computed later from this table + ticker_tags

create table if not exists ticker_factor_score_snapshots (
  id bigserial primary key,
  snapshot_date date not null,
  ticker text not null,
  factor_key text not null,
  axis_key text not null,

  score numeric(10,6) not null,
  confidence numeric(10,6),
  sample_window text,
  source_note text,

  created_at timestamptz not null default now(),

  constraint ticker_factor_score_snapshots_ticker_fk
    foreign key (ticker)
    references ticker_profiles (ticker)
    on delete cascade,

  constraint ticker_factor_score_snapshots_factor_key_fk
    foreign key (factor_key)
    references factor_definitions (key)
    on delete restrict,

  constraint ticker_factor_score_snapshots_axis_key_fk
    foreign key (axis_key)
    references factor_score_axis_definitions (key)
    on delete restrict,

  constraint ticker_factor_score_snapshots_score_range_chk
    check (score >= 0 and score <= 1),

  constraint ticker_factor_score_snapshots_confidence_range_chk
    check (confidence is null or (confidence >= 0 and confidence <= 1)),

  constraint ticker_factor_score_snapshots_sample_window_not_blank_chk
    check (sample_window is null or length(btrim(sample_window)) > 0),

  constraint ticker_factor_score_snapshots_source_note_not_blank_chk
    check (source_note is null or length(btrim(source_note)) > 0),

  constraint ticker_factor_score_snapshots_unique_row_uk
    unique (snapshot_date, ticker, factor_key, axis_key)
);

create index if not exists ticker_factor_score_snapshots_snapshot_date_idx
  on ticker_factor_score_snapshots (snapshot_date);

create index if not exists ticker_factor_score_snapshots_ticker_idx
  on ticker_factor_score_snapshots (ticker);

create index if not exists ticker_factor_score_snapshots_factor_key_idx
  on ticker_factor_score_snapshots (factor_key);

create index if not exists ticker_factor_score_snapshots_axis_key_idx
  on ticker_factor_score_snapshots (axis_key);

create index if not exists ticker_factor_score_snapshots_ticker_snapshot_idx
  on ticker_factor_score_snapshots (ticker, snapshot_date desc);

create index if not exists ticker_factor_score_snapshots_factor_axis_snapshot_idx
  on ticker_factor_score_snapshots (factor_key, axis_key, snapshot_date desc);
