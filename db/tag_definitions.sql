-- tag_definitions.sql
-- Master table for all tags used in the system.
-- Defines what each tag means (NOT how it is assigned).

create table if not exists tag_definitions (
  key text primary key,
  name text not null,
  category text not null,
  description text,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tag_definitions_key_snake_case_chk
    check (key ~ '^[a-z][a-z0-9_]*$'),

  constraint tag_definitions_name_not_blank_chk
    check (length(btrim(name)) > 0),

  constraint tag_definitions_category_not_blank_chk
    check (length(btrim(category)) > 0)
);

create index if not exists tag_definitions_category_idx
  on tag_definitions (category);

create index if not exists tag_definitions_is_active_idx
  on tag_definitions (is_active);

create index if not exists tag_definitions_display_order_idx
  on tag_definitions (display_order);

