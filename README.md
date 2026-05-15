# Geo Portfolio

Geo Portfolio is a local financial analysis app that turns company filings,
market data, macro series, and portfolio inputs into inspectable signals.

The app is built for research and explanation. It does not try to hide messy
financial reporting behind a single clean score; it shows the source data,
feature logic, factor signals, and limitations behind each view.

## What The App Shows

Geo Portfolio is organized as a workstation for looking at companies and
portfolios from several angles:

- portfolio holdings, price status, and AI-assisted portfolio analysis
- ticker profiles, classifications, and SEC-derived metric series
- factor metrics, factor-owned features, and selected factor signals
- daily price history and implied financial expectations
- market signal-combination overviews and timelines
- macro series context from FRED
- methodology pages explaining data lineage, feature selection, and warnings
- signal validation views for checking how factor signals behave over time

The goal is to make the business motion visible: revenue growth, margin
structure, profitability, cash generation, reinvestment, balance sheet pressure,
market behavior, and how those signals compare across related companies.

## Core Idea

Financial analysis in this app is organized as:

```text
factor -> axis -> metric -> feature -> signal
```

A factor represents a broad analytical theme, such as growth, quality, value,
income, rate sensitivity, defensive strength, or capital expenditure cycles.

An axis describes where the evidence comes from, such as fundamentals, market
price, valuation, macro-linked data, ETF exposure, or narrative-implied data.

A metric is a measurable company attribute, such as revenue, operating income,
cash, debt, price, dividends, or capital expenditure.

A feature is a factor-owned reading of a metric, such as latest growth, durable
growth, acceleration, benchmark comparison, macro contrast, or vector-eligible
evidence.

A signal is the selected interpretation: improvement, deterioration, recovery,
pressure, durability, or incomplete evidence.

## Current Analysis Focus

The examples below focus on the most mature analysis paths rather than listing
every factor and metric in the system.

The most developed path is fundamentals-based factor analysis. Growth currently
uses company filing data to read:

- `revenue`
- `gross_profit`
- `operating_income`
- `net_income`
- `operating_cash_flow`

Capital expenditure is tracked separately through the `capex_cycle` factor,
where `capex_cash`, `capex_incurred`, and `investing_cash_flow` describe
reinvestment behavior.

Other factor families in the system include quality, value, income, size,
momentum, high beta, low volatility, defensive, rate sensitive, energy linked,
liquidity sensitive, inflation hedge, commodity linked, and related exposure
themes.

## What Growth Means Here

Growth is not treated as one number. The app looks for several behaviors:

- latest growth
- durable trailing growth
- acceleration or deceleration
- profitability support
- operating cash flow support
- turnaround or loss-narrowing evidence
- missing, sparse, or low-confidence data

This makes it possible to distinguish companies with similar headline growth but
different underlying quality.

## Data Used

Geo Portfolio combines local and external data sources:

- **SEC Company Facts** for structured financial statement data
- **SEC filing metadata** for fiscal periods and filing context
- **Financial Modeling Prep** for company profiles and metadata
- **Twelve Data** for market price and time-series data
- **FRED** for macroeconomic series
- **Local configuration and database definitions** for factor metadata, feature
  definitions, signal thresholds, display labels, and clustering policies

## Analysis Views

Typical questions the app is meant to answer:

- What does this portfolio hold, and how are prices updating?
- What is this company, and how is it classified?
- Which SEC-derived metric series are available for this ticker?
- Which factor features are active for a company?
- Which factor signal was selected, and what evidence supported it?
- Are growth, quality, cash flow, or capex signals improving or weakening?
- What expectations are implied by the current market price?
- Which market signal combinations have historically mattered?
- Which macro series may be relevant to the broader context?
- Where is the data incomplete, ambiguous, or low-confidence?

## Why It Exists

Geo Portfolio is an experimental workspace for building a more structured way to
look at companies and portfolios.

Instead of starting from prose commentary or a single valuation number, the app
starts from repeatable data reconstruction:

```text
raw filings and market data
  -> normalized company series
  -> factor-owned features
  -> selected factor signals
  -> ticker, market, macro, and portfolio views
```

That structure keeps analysis explainable. A signal or summary should be
traceable back to the metric behavior and evidence that produced it.

## Current Limitations

- Coverage varies by company, reporting style, and available vendor data.
- Some SEC tags require careful mapping before they can be compared.
- Derived metrics and factor families are still expanding.
- Signal definitions are more mature for fundamentals than for every market,
  macro, ETF, or narrative path.
- Validation views are research tools, not proof of predictive power.
- The system is for research and analysis, not investment advice.

## Developer Docs

Developer setup and implementation notes live under `docs/`.

- `docs/README.md`
- `docs/developer/quick-start.md`
- `docs/developer/frontend-backend-flow.md`
- `docs/developer/ticker-vectorization.md`
- `docs/operations/backend-structure-policy.md`
- `docs/operations/database-access-policy.md`
- `docs/operations/scripts-data-policy.md`
- `docs/operations/naming-policy.md`
