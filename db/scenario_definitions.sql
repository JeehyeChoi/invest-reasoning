create table if not exists scenario_definitions (
  key text primary key,
  name text not null,
  description text,
  category text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint scenario_definitions_key_format_chk
    check (key ~ '^[a-z0-9_]+$'),

  constraint scenario_definitions_name_nonempty_chk
    check (length(trim(name)) > 0)
);

create index if not exists scenario_definitions_category_idx
  on scenario_definitions (category);

create index if not exists scenario_definitions_is_active_idx
  on scenario_definitions (is_active);

comment on table scenario_definitions is
  'Defines macro, geopolitical, or thematic scenarios used to analyze portfolio sensitivity.';
