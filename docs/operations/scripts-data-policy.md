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
- `data/sec/tag-inventory/**` contains SEC taxonomy tag inventory exports.
- `docs/reference/**` contains curated reference material that should be remembered but is not imported by runtime code.

## Tag Naming

- Use `classification tag` for portfolio, company, sector, industry, style, or listing classification.
- Use `SEC tag` or `taxonomy tag` for tags from SEC Company Facts/XBRL.
- Avoid new generic `tag` names in scripts, logs, and data paths.
- Existing DB tables such as `tag_definitions` and `ticker_tags` currently mean classification tags. Rename them only through an explicit migration.

## Bootstrap Flow

```text
scripts/bootstrap.sh
  -> scripts/db/create.sh
  -> scripts/db/init.sh
  -> scripts/bootstrap/classification-tags/extract-definition-candidates.mjs
  -> scripts/bootstrap/classification-tags/import-definitions.mjs
  -> scripts/bootstrap/factors/import-definitions.mjs
```

Scripts may be commented out in the entrypoint while the bootstrap sequence is being developed, but paths should still point to the canonical locations.
