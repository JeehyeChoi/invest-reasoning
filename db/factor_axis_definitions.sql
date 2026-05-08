-- factor_axis_definitions.sql
-- Defines the evidence axes used to organize factor metric features.
-- These axes represent observed evidence dimensions, not calculation methods.

create table if not exists factor_axis_definitions (
  key text primary key,
  name text not null,
  description text not null,
  data_source_hint text,
  update_frequency text,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint factor_axis_definitions_key_snake_case_chk
    check (key ~ '^[a-z][a-z0-9_]*$'),

  constraint factor_axis_definitions_name_not_blank_chk
    check (length(btrim(name)) > 0),

  constraint factor_axis_definitions_description_not_blank_chk
    check (length(btrim(description)) > 0),

  constraint factor_axis_definitions_update_frequency_chk
    check (
      update_frequency is null
      or update_frequency in ('low', 'medium', 'high')
    )
);

create index if not exists factor_axis_definitions_is_active_idx
  on factor_axis_definitions (is_active);

create index if not exists factor_axis_definitions_display_order_idx
  on factor_axis_definitions (display_order);

-- This is a small definition table whose source of truth is this file.
-- Reapplying the file should fully reflect the current design, including
-- removal of axes that no longer exist in code.
delete from public.factor_axis_definitions;

insert into public.factor_axis_definitions
  (key, name, description, data_source_hint, update_frequency, display_order, is_active)
values
  (
    'etf_exposure',
    'ETF Exposure',
    'Factor metric feature inferred from ETF holdings, ETF baskets, or ETF return similarity, estimating thematic, sector, or style exposure for a ticker.',
    'ETF holdings, ETF baskets, return similarity',
    'medium',
    1,
    true
  ),
  (
    'fundamentals_based',
    'Fundamentals-Based',
    'Factor metric feature derived from financial and operating metrics such as revenue growth, margins, leverage, dividend profile, and capital intensity.',
    'financial statements, operating metrics, company fundamentals',
    'medium',
    2,
    true
  ),
  (
    'market_price',
    'Market Price',
    'Factor metric feature derived from daily price and volume behavior such as returns, momentum, volatility, drawdown, and market sensitivity.',
    'daily OHLCV history',
    'high',
    3,
    true
  ),
  (
    'valuation',
    'Valuation',
    'Factor metric feature derived from market value relative to fundamentals, such as sales, earnings, book value, cash flow, yield, own-history premium, or peer premium.',
    'market capitalization, enterprise value, shares, price snapshots, fundamentals',
    'medium',
    4,
    true
  ),
  (
    'macro_linked',
    'Macro Linked',
    'Factor metric feature derived from relationships to macroeconomic series, rates, inflation, commodities, financial conditions, or market regimes.',
    'macro series, market regimes, cross-asset data',
    'medium',
    5,
    true
  ),
  (
    'narrative_implied',
    'Narrative-Implied',
    'Factor metric feature inferred from public narrative and interpretive context such as news, earnings calls, filings, policy discourse, and market storytelling.',
    'news, transcripts, filings, policy signals',
    'high',
    6,
    true
  )
on conflict (key) do update
set
  name = excluded.name,
  description = excluded.description,
  data_source_hint = excluded.data_source_hint,
  update_frequency = excluded.update_frequency,
  is_active = excluded.is_active,
  display_order = excluded.display_order,
  updated_at = now();
