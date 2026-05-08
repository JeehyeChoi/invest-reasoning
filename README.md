# Geo Portfolio

Geo Portfolio is a local financial analysis app that turns company filings,
market data, and macro context into structured signals for understanding how a
business is changing.

The app is focused on analysis, not trading automation. It helps inspect a
company's fundamentals through repeatable data pipelines and factor-based
views.

## What The App Shows

Geo Portfolio gives each ticker a structured overview built from several layers
of data:

- company profile and classification
- SEC-derived financial time series
- factor metrics
- metric-level signal breakdowns
- market and peer cluster context
- macro series context
- portfolio analysis output

The goal is to make the underlying business motion easier to inspect: revenue
growth, margin structure, profitability, cash generation, reinvestment, and how
those signals compare across related companies.

## Core Idea

Financial analysis in this app is organized as:

```text
factor -> axis -> metric -> signal
```

A factor represents a broad analytical theme, such as growth.

An axis represents where the evidence comes from, such as fundamentals,
market-implied data, or narrative-implied data.

A metric is a measurable company attribute, such as revenue, operating income,
net income, operating cash flow, or capital expenditure.

A signal is the interpreted behavior of that metric: growth, acceleration,
consistency, recovery, deterioration, or data coverage.

## Current Analysis Focus

The examples below focus on the most mature analysis paths rather than listing
every factor and metric in the system.

The most developed factor is growth, built from SEC fundamentals.

Current growth metrics include:

- `revenue`
- `gross_profit`
- `operating_income`
- `net_income`
- `operating_cash_flow`

These metrics are used to separate top-line expansion, profit conversion, cash
validation, and durability instead of reducing growth to a single number.

Capital expenditure is tracked separately through the `capex_cycle` factor,
where `capex_cash`, `capex_incurred`, and `investing_cash_flow` describe
reinvestment behavior.

## What Growth Means Here

Growth is not treated as one score. The app evaluates several behaviors:

- year-over-year change
- quarter-over-quarter change
- consistency across periods
- acceleration or deceleration
- turnaround signals
- loss narrowing where applicable
- missing or incomplete data coverage

This makes it possible to distinguish companies with similar headline growth but
different underlying quality.

## Data Used

Geo Portfolio combines local and external data sources:

- **SEC Company Facts** for structured financial statement data
- **SEC filing metadata** for fiscal periods and filing context
- **Financial Modeling Prep** for company profiles and metadata
- **Twelve Data** for market price and time-series data
- **FRED** for macroeconomic series
- **Local configuration** for factor definitions, display metadata, and
  interpretation rules

## Analysis Views

The app is designed around inspectable views rather than black-box output.

Typical questions it helps answer:

- What is this company, and how is it classified?
- Which financial metrics are available for this ticker?
- How stable is revenue growth?
- Are profitability metrics improving with revenue?
- Does cash flow support the reported growth story?
- Is capital expenditure expanding, contracting, or behaving unusually?
- Which metrics are missing, sparse, or difficult to compare?
- How does this ticker relate to nearby companies or clusters?
- What macro series may be relevant to the broader context?

## Why It Exists

Geo Portfolio is an experimental workspace for building a more structured way to
look at companies.

Instead of starting from prose commentary or a single valuation number, the app
starts from repeatable data reconstruction:

```text
raw filings
  -> normalized company series
  -> metric signals
  -> factor interpretation
  -> ticker and portfolio views
```

That structure keeps the analysis explainable. A score or summary should always
be traceable back to the metric behavior that produced it.

## Current Limitations

- Coverage varies by company and reporting style.
- Some SEC tags require careful mapping before they can be compared.
- Derived metrics are still being expanded.
- Market, macro, and narrative-implied factors are less mature than SEC
  fundamentals.
- The system is for research and analysis, not investment advice.

## Developer Docs

Developer setup and implementation notes live under `docs/`.

- `docs/README.md`
- `docs/developer/quick-start.md`
- `docs/developer/frontend-backend-flow.md`
- `docs/developer/ticker-factor-metric-clustering.md`
- `docs/operations/backend-structure-policy.md`
- `docs/operations/database-access-policy.md`
- `docs/operations/scripts-data-policy.md`
- `docs/operations/naming-policy.md`
