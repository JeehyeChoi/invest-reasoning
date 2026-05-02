# Geo Portfolio

Geo Portfolio is a local-first financial analysis system for reconstructing
company fundamentals from SEC data, computing factor-level signals, and serving
the results through a Next.js UI.

The project is built for exploratory financial data modeling and system design.
It is not production investment tooling.

## What It Does

- Ingests SEC Company Facts and filing metadata
- Maps raw SEC tags into canonical financial metrics
- Reconstructs company fiscal periods and quarterly metric series
- Computes factor metric signals, scores, and interpretations
- Stores ticker profiles, classifications, market data, and factor outputs
- Serves analysis views through API routes and frontend feature components

## Current Scope

The most mature area is the growth factor, using fundamentals-derived metrics:

- `revenue`
- `gross_profit`
- `operating_income`
- `net_income`
- `operating_cash_flow`
- `capex`

Growth is evaluated with signals such as year-over-year growth,
quarter-over-quarter growth, consistency, acceleration, turnaround behavior, and
loss narrowing where applicable.

Additional areas in progress include:

- ticker core profile and classification sync
- SEC bulk ingest and fiscal period reconstruction
- SEC tag, metric, and validation series workflows
- ticker factor metric clustering
- FRED macro series ingestion
- portfolio analysis workflows

## Data Sources

- **SEC Company Facts**: structured company fundamentals
- **SEC filing metadata**: filing context, fiscal period, and filing dates
- **Financial Modeling Prep (FMP)**: company profiles and metadata
- **Twelve Data**: market price and time-series data
- **FRED**: macroeconomic time series
- **Local bootstrap/config files**: factor, scoring, and classification metadata

## System Flow

```text
external / local data
  -> backend clients
  -> backend services
  -> workflows
  -> PostgreSQL tables
  -> API routes
  -> frontend feature fetchers
  -> UI views
```

For user-facing live data, the preferred application boundary is:

```text
page
  -> feature component
  -> feature service fetcher
  -> API route
  -> backend service
  -> database / external client / workflow
```

See `docs/frontend-backend-flow.md` for the detailed layering policy.

## Project Layout

```text
src/app
  Next.js pages and API routes

src/backend
  Server-side clients, services, workflows, tools, and orchestration code

src/backend/config
  Factor, SEC, and analysis configuration

data
  Local bootstrap data and downloaded SEC assets

db
  Database schema and migration-style SQL files

docs
  Architecture notes, workflow guides, and project policies

scripts
  Bootstrap, database, SEC inspection, and factor scaffolding scripts
```

## Local Development

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env.local
```

Fill in the database URL and any vendor API keys required by the workflows you
plan to run.

Start the app:

```bash
npm run dev
```

Other useful commands:

```bash
npm run build
npm run lint
```

## Environment

The app expects a local PostgreSQL database and uses environment variables for
external providers. See `.env.example` for the current baseline.

Database helper scripts live under `scripts/db/`.

## Common Workflows

Initialize or refresh local data:

```bash
./scripts/bootstrap.sh
```

Create a new factor metric scaffold:

```bash
./scripts/factors/scaffold-factor-metric.sh <factor> <metric_key>
```

Inspect SEC data:

```bash
node scripts/sec/inspect-companyfacts.mjs
node scripts/sec/inspect-submissions.mjs
node scripts/sec/inspect-frames.mjs
```

## Design Principles

- Model analysis as `factor -> axis -> metric`
- Prefer multiple structured signals over a single score
- Keep raw data, signal computation, scoring, and interpretation separate
- Treat missing company data as expected input, not necessarily an error
- Use API routes as the normal boundary for user-facing live data
- Keep backend services responsible for domain logic and data access

## Known Limitations

- Metric coverage varies by company and reporting structure
- Most metrics currently rely on canonical SEC tags
- Derived metrics such as free cash flow are not fully implemented
- Several workflows and helper scripts are still evolving
- The system is intended for analysis and modeling, not investment advice

## Documentation

- `docs/quick-start.md`: development setup and adding metrics
- `docs/frontend-backend-flow.md`: frontend/API/backend boundary rules
- `docs/backend-structure-policy.md`: backend organization policy
- `docs/scripts-data-policy.md`: scripts and data ownership policy
- `docs/ticker-factor-metric-clustering.md`: clustering workflow notes
