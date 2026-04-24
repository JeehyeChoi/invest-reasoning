# Geo Portfolio

Geo Portfolio is a local analysis system that reconstructs financial time series from SEC filings and evaluates company growth using multiple signals.

It focuses on separating growth into revenue, profitability, and cash flow layers, rather than relying on a single metric.

The system is designed for exploratory analysis and system design, not production-grade financial modeling.

---

## What This Project Does

- Reconstructs company-level financial series from SEC Company Facts
- Maps raw SEC tags into canonical financial metrics
- Computes growth signals across multiple dimensions
- Stores and serves factor-based metrics per ticker
- Visualizes metric-level breakdown, formulas, and interpretations

---

## What You Can Inspect

- Company profile and metadata
- SEC-derived financial time series
- Growth factor signals per metric
- Score breakdown (YoY, QoQ, consistency, acceleration, etc.)
- Formula and interpretation metadata
- Missing data coverage per metric

---

## Data Sources

- **SEC Company Facts**  
  Structured financial statement data (revenue, income, cash flow)

- **SEC filings metadata**  
  Filing context (form type, fiscal period, filing dates)

- **Financial Modeling Prep (FMP)**  
  Company profiles and metadata

- **Twelve Data**  
  Market price and time-series data

- **Local configuration files**  
  Metric scoring and display definitions (`heuristic.json`, `display.json`)

---

## System Overview

SEC companyfacts are mapped into canonical metrics, reconstructed into time series, and evaluated using config-driven scoring models.

Pipeline:

```
SEC raw companyfacts
→ canonical metric mapping (tagMeta)
→ quarterly series reconstruction
→ growth signal computation
→ factor metric storage
→ ticker overview API
→ UI visualization
```

---

## Current Scope

The current implementation is limited to the **growth factor (fundamentals_based)**.

### Implemented Metrics

- revenue
- gross_profit
- operating_income
- net_income
- operating_cash_flow
- capex

### What These Metrics Capture

- **Top-line growth** → revenue
- **Profitability structure** → gross → operating → net
- **Cash validation** → operating cash flow
- **Reinvestment intensity** → capex

Support for additional factors and methodologies is planned.

---

## How Growth Is Evaluated

Each metric is evaluated using:

- Year-over-year growth (YoY)
- Quarter-over-quarter growth (QoQ)
- Consistency of growth
- Acceleration / deceleration
- Turnaround and loss-narrowing signals (when applicable)

Scores are computed using configurable weights and exposed per ticker.

---

## Design Principles

- Decompose analysis into **factor → axis → metric**
  - Factors represent high-level themes (e.g. growth, value)
  - Axes represent methodologies (e.g. fundamentals-based)
  - Metrics represent measurable signals (e.g. revenue, cash flow)

- Evaluate companies through **multiple signals instead of a single metric**
  - Growth is not defined by one number, but by a combination of revenue, profitability, and cash flow

- Treat financial data as **structured signals, not raw values**
  - Metrics are interpreted through consistency, acceleration, and direction, not just absolute levels

- Separate **data, scoring, and interpretation**
  - Raw data → signals → scores → human-readable interpretation

- Design for **extensibility of models**
  - Heuristic scoring can evolve into quantitative or model-based approaches without changing the data layer

---

## Current Scope

- Metrics are based on canonical SEC tags only
- Coverage varies by company and reporting structure
- Derived metrics (e.g. free cash flow) are not yet implemented
- Some companies do not report all metrics (expected behavior)

---

## Development

For setup and development workflow:

See:
- `docs/quick-start.md` (development setup and usage, in progress)

---

## Notes

This project is an evolving system focused on:

- financial data modeling
- factor-based analysis design
- scalable metric pipelines

rather than production-ready investment tooling.


