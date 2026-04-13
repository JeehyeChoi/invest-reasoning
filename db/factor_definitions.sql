-- factor_definitions.sql
-- Master definition table for portfolio analysis factors.
-- This table stores factor identity and metadata only.
-- It does NOT store ticker-level scores, loadings, or scenario shocks.

create table if not exists factor_definitions (
  key text primary key,
  name text not null,
  category text not null,
  description text,
  interpretation_hint text,
  polarity text,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint factor_definitions_key_format_chk
    check (key ~ '^[a-z0-9_]+$'),

  constraint factor_definitions_category_nonempty_chk
    check (length(trim(category)) > 0),

  constraint factor_definitions_name_nonempty_chk
    check (length(trim(name)) > 0)
);

comment on table factor_definitions is
  'Master dictionary of analysis factors such as growth, quality, rate_sensitive, or china_exposure.';

comment on column factor_definitions.key is
  'Stable machine-readable identifier used by code and foreign keys. Use lowercase snake_case.';

comment on column factor_definitions.name is
  'Human-readable display name for UI and reports.';

comment on column factor_definitions.category is
  'High-level grouping for factors, e.g. style, macro, geopolitical, structural.';

comment on column factor_definitions.description is
  'Plain-language definition of what the factor represents.';

comment on column factor_definitions.interpretation_hint is
  'Short practical note for how to interpret this factor in portfolio analysis.';

comment on column factor_definitions.polarity is
  'Optional directional/meta label such as pro_risk, defensive, inflation_linked, or rate_linked.';

comment on column factor_definitions.is_active is
  'Soft activation flag for hiding deprecated or experimental factors without deleting them.';

comment on column factor_definitions.display_order is
  'UI ordering hint for factor lists and grouped displays.';

comment on column factor_definitions.created_at is
  'Creation timestamp.';

comment on column factor_definitions.updated_at is
  'Last update timestamp.';

create index if not exists factor_definitions_category_idx
  on factor_definitions (category, display_order, key);

create index if not exists factor_definitions_active_idx
  on factor_definitions (is_active, display_order, key);
