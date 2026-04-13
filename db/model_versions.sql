create table if not exists model_versions (
  key text primary key,
  name text not null,
  model_type text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint model_versions_key_format_chk
    check (key ~ '^[a-z0-9_]+$'),

  constraint model_versions_name_nonempty_chk
    check (length(trim(name)) > 0),

  constraint model_versions_model_type_nonempty_chk
    check (length(trim(model_type)) > 0)
);

create index if not exists model_versions_model_type_idx
  on model_versions (model_type);

create index if not exists model_versions_is_active_idx
  on model_versions (is_active);

comment on table model_versions is
  'Registry of model and scoring logic versions used across tag inference, factor scoring, and scenario analysis.';

comment on column model_versions.key is
  'Stable machine-readable identifier for the model version.';

comment on column model_versions.name is
  'Human-readable model version name.';

comment on column model_versions.model_type is
  'High-level model family, such as factor_scoring, tag_inference, or scenario_model.';

comment on column model_versions.description is
  'Free-text explanation of what the model version does or how it differs from others.';

comment on column model_versions.is_active is
  'Whether this model version is currently active for operational use.';
