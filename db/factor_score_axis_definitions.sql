-- factor_score_axis_definitions.sql
-- Defines the evidence axes used to score the relationship between a ticker and a factor.
-- These axes represent observed evidence dimensions, not calculation methods.

create table if not exists factor_score_axis_definitions (
  key text primary key,
  name text not null,
  description text not null,
  data_source_hint text,
  update_frequency text,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint factor_score_axis_definitions_key_snake_case_chk
    check (key ~ '^[a-z][a-z0-9_]*$'),

  constraint factor_score_axis_definitions_name_not_blank_chk
    check (length(btrim(name)) > 0),

  constraint factor_score_axis_definitions_description_not_blank_chk
    check (length(btrim(description)) > 0),

  constraint factor_score_axis_definitions_update_frequency_chk
    check (
      update_frequency is null
      or update_frequency in ('low', 'medium', 'high')
    )
);

create index if not exists factor_score_axis_definitions_is_active_idx
  on factor_score_axis_definitions (is_active);

create index if not exists factor_score_axis_definitions_display_order_idx
  on factor_score_axis_definitions (display_order);

-- Keep the table aligned with the current design:
-- taxonomy_based has been removed from the score axes because taxonomy/tag relationships
-- are now handled separately through empirical tag-factor relationship analysis.

delete from factor_score_axis_definitions
where key = 'taxonomy_based';

insert into factor_score_axis_definitions
  (key, name, description, data_source_hint, update_frequency, display_order, is_active)
values
  (
    'etf_implied',
    'ETF-Implied',
    'Factor signal inferred from ETF and index composition, reflecting market-consensus positioning for a ticker.',
    'ETF holdings, index composition',
    'medium',
    1,
    true
  ),
  (
    'fundamentals_based',
    'Fundamentals-Based',
    'Factor signal derived from financial and operating metrics such as revenue growth, margins, leverage, beta, dividend profile, and capital intensity.',
    'market data, financial statements, ratios',
    'medium',
    2,
    true
  ),
  (
    'narrative_implied',
    'Narrative-Implied',
    'Factor signal inferred from public narrative and interpretive context such as news, earnings calls, filings, policy discourse, and market storytelling.',
    'news, transcripts, filings, policy signals',
    'high',
    3,
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
