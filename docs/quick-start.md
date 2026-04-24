# Quick Start (Development)

This guide covers how to run the project locally and add new factor metrics.

---

## 1. Setup

```bash
git clone <repo>
cd geo-portfolio
npm install
```

---

## 2. Environment Variables

Create a local environment file:

```bash
cp .env.sample .env.local
```

Fill in required values:

- Database connection settings
- Financial Modeling Prep (FMP) API key
- Twelve Data API key
- Any other required service keys

---

## 3. Run

```bash
npm run dev
```

The system will automatically:

- initialize data (if needed)
- run factor workflows
- compute metrics

---

## 4. Adding a New Metric

Use the scaffold script:

```bash
sh ./scripts/scaffold-factor-metric.sh <factor> <metric_key>
```

Example:

```bash
sh ./scripts/scaffold-factor-metric.sh growth operating_cash_flow
```

This will generate:

- `resolve.ts`
- `compute.ts`
- `upsert.ts`
- `run.ts`
- step runner registration

---

## 5. Required Manual Steps

After scaffolding, you must update:

- `tagMeta.ts`  
  → map SEC tags to the new metric

- `blueprints.ts`  
  → include the metric under the correct factor/axis

- `heuristic.json`  
  → define scoring weights and compute mode

- `display.json`  
  → define UI metadata

- `interpretGrowthMetrics.ts`  
  → add or adjust interpretation logic if needed

---

## 6. Notes

- Missing data is expected (not all companies report all metrics)
- Metrics are based on canonical SEC tags
- Derived metrics (e.g. free cash flow) are not yet implemented
- Some helper scripts (`.mjs`, DB setup scripts) are still evolving and may require manual inspection
