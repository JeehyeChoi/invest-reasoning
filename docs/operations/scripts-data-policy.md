# Scripts And Data Policy

## Principles

- `scripts/bootstrap.sh` is the top-level bootstrap entrypoint.
- Bootstrap scripts prepare the local database or generated seed data. They should live under `scripts/bootstrap/**`.
- Domain maintenance scripts should live under their domain folder, such as `scripts/sec/**` or `scripts/factors/**`.
- Database schema files stay in `db/**`. Keep them flat unless a domain grows enough to need grouping.
- Bootstrap seed inputs may live beside the bootstrap script that imports them.
- Generated or downloaded data must not live under `src/**`.
- `src/shared/**` is for runtime code, contracts, and public vocabulary. It is not a memory store for future curation notes.

## Data Locations

- `data/bootstrap/**` contains generated bootstrap inputs used by local initialization scripts.
- `scripts/bootstrap/**` may contain versioned seed inputs required by its local bootstrap script.
- `data/sec/bulk/**` contains downloaded SEC bulk archives. `SEC_DATA_DIR` should point here.
- `data/sec/inspection/**` contains exploratory SEC inspection output.
- `docs/reference/**` contains curated reference material that should be remembered but is not imported by runtime code.

## Tag Naming

- Use `classification tag` for portfolio, company, sector, industry, style, or listing classification.
- Use `SEC tag` or `taxonomy tag` for tags from SEC Company Facts/XBRL.
- Avoid new generic `tag` names in scripts, logs, and data paths.
- Existing DB tables such as `tag_definitions` and `ticker_tags` currently mean classification tags. Rename them only through an explicit migration.

## Bootstrap Flow

```text
scripts/bootstrap.sh
  -> scripts/bootstrap/factors/import-definitions.mjs
```

Portfolio classification tag seeds are retained under
`data/bootstrap/classification-tags/**`, but their import is disabled until the
portfolio tag flow is reworked.

Database creation and schema initialization are explicit setup steps:

```text
scripts/db/create.sh
scripts/db/init.sh
```

Operational data refresh jobs should run through the startup page and
`/api/internal/data-pipeline/refresh`, not one-off `.mjs` scripts.
