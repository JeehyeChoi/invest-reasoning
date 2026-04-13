create table if not exists scenario_factor_shocks (
  id bigserial primary key,
  scenario_key text not null,
  factor_key text not null,

  shock numeric(10,6) not null,
  confidence numeric(10,6),
  note text,

  created_at timestamptz not null default now(),

  constraint scenario_factor_shocks_scenario_fk
    foreign key (scenario_key) references scenario_definitions(key),

  constraint scenario_factor_shocks_factor_fk
    foreign key (factor_key) references factor_definitions(key)
);

create index if not exists scenario_factor_shocks_scenario_idx
  on scenario_factor_shocks (scenario_key);

create index if not exists scenario_factor_shocks_factor_idx
  on scenario_factor_shocks (factor_key);

comment on table scenario_factor_shocks is
  'Defines how each factor is affected under a given scenario.';
