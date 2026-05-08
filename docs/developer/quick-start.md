# Quick Start

This guide covers the current local development flow for Geo Portfolio: install
dependencies, configure the database, initialize baseline data, run the app, and
add factor metrics.

## 1. Install

```bash
git clone <repo>
cd geo-portfolio
npm install
```

## 2. Configure Environment

Create local environment files:

```bash
cp .env.example .env.local
cp .env.example .env.local.psql
```

Fill in the values needed for the workflows you plan to run:

- `DATABASE_URL`
- `DB_PASSWORD`
- `SEC_DATA_DIR`
- `FMP_API_KEY`
- `TWELVE_DATA_API_KEY`
- `ANTHROPIC_API_KEY`

`scripts/db/create.sh` reads `DB_PASSWORD` from `.env.local`.
`scripts/db/init.sh` and bootstrap import scripts use `DATABASE_URL` from
`.env.local.psql` when present.

The app expects PostgreSQL locally. The default helper scripts create/use:

```text
database: geo_portfolio
owner:    geo_master
```

## 3. Prepare Database

Create the local database and owner:

```bash
./scripts/db/create.sh
```

Initialize schemas:

```bash
./scripts/db/init.sh
```

The schema script applies the SQL files under `db/`, including ticker core,
factor definitions, SEC Company Facts tables, signal tables, FRED macro tables,
and scenario tables.

## 4. Bootstrap Local Metadata

Run the active bootstrap metadata imports:

```bash
./scripts/bootstrap.sh
```

This currently imports:

- factor definitions

Portfolio classification tag definitions are kept as a seed, but should stay
commented out until the portfolio tag flow is reworked.

Database creation and schema initialization are kept as explicit steps above;
`scripts/bootstrap.sh` does not run them by default.

## 5. Run The App

```bash
npm run dev
```

Open `http://localhost:3000`. A fresh database may show empty screens or sparse
results; that is expected until operational data is loaded.

Use `http://localhost:3000/startup` to run data download and refresh jobs such
as universe membership sync, ticker core sync, price history, SEC bulk ingest,
metric series, feature generation, and factor signals.

The local app runs through Next.js. User-facing live data should flow through:

```text
page
  -> feature component
  -> feature service fetcher
  -> API route
  -> backend service
  -> database / external client / workflow
```

Useful local API routes include:

- `/api/internal/data-pipeline/status`
- `/api/internal/data-pipeline/refresh`
- `/api/internal/sec-bulk-ingest/state`
- `/api/tickers/[ticker]/overview`
- `/api/tickers/[ticker]/series/[metricKey]`
- `/api/market/cluster/overview`
- `/api/macro/fred/series/refresh`

See `docs/developer/frontend-backend-flow.md` for the project layering policy.

## 6. Run Checks

```bash
npm run lint
npm run build
```

## 7. Inspect SEC Data

Useful inspection scripts:

```bash
node scripts/sec/inspect-companyfacts.mjs
node scripts/sec/inspect-submissions.mjs
node scripts/sec/inspect-frames.mjs
```

SEC bulk data is expected under:

```text
data/sec/bulk
```

This location can be overridden with `SEC_DATA_DIR`.

## 8. Add A Factor Metric

Create the metric config scaffold:

```bash
./scripts/factors/scaffold-factor-metric.sh <factor> <metric_key>
```

Example:

```bash
./scripts/factors/scaffold-factor-metric.sh growth operating_cash_flow
```

The scaffold creates factor axis directories and metric config files under:

```text
src/backend/config/factors/<factor>/fundamentals_based/<metric_key>/
```

Expected config files:

- `display.json`
- `interpretation.json`

The scaffold also writes a checklist to
`tmp/<factor>-<axis>-<metric_key>-checklist.md`.

## 9. Register A Metric

After scaffolding, review and update the relevant registration points:

- `src/shared/sec/metrics.ts`: add the metric key to the shared SEC metric type
- `src/backend/services/sec/companyFacts/series/tagMeta.ts`: map SEC tags to the metric
- `src/backend/config/factors/blueprints.ts`: register the metric under the factor axis
- `src/backend/config/factors/<factor>/fundamentals_based/<metric_key>/display.json`: define display metadata
- `src/backend/config/factors/<factor>/fundamentals_based/<metric_key>/interpretation.json`: define factor-owned metric feature metadata

When a metric is shared by multiple factors, `blueprints.ts` should still make
the role explicit through `metricProfiles`:

- `core`: the factor's main evidence metric
- `supporting`: secondary factor evidence
- `context`: cross-factor context used to interpret another metric family

For sign-sensitive metrics such as capex, also review `metricProfiles` in
`src/backend/config/factors/blueprints.ts`.

## 10. Current Growth Metrics

The current growth fundamentals blueprint includes:

- `revenue`
- `net_income`
- `operating_income`
- `gross_profit`
- `operating_cash_flow`

Capex metrics belong to the `capex_cycle` factor, not the growth blueprint.

## Notes

- Missing company data is expected because reporting structures vary.
- Metric series are built from SEC facts and canonical tag mappings.
- Derived metrics need explicit build logic in the SEC Company Facts series layer.
- `npm run dev` starts the app; it does not automatically initialize the database
  or run every data workflow.
- Some workflows require populated SEC/FMP/Twelve Data/FRED inputs before the UI
  has meaningful data to display.
