# Factor Definition Registry

This project is moving factor configuration from TypeScript/file-based config
toward SQL-seeded definition tables.

The current system is intentionally hybrid:

- SQL files under `db/` are the source of truth for feature definitions,
  display metadata, and signal selection rules.
- `src/backend/config/factors/blueprints.ts` still defines which
  factor/axis/metric combinations are in scope for calculation workflows.
- `src/backend/config/factors/active.ts` resolves runtime display config from
  the SQL definition tables.

The target direction is to move factor/axis/metric scope fully into SQL as well,
so `blueprints.ts` can eventually become generated, deprecated, or reduced to a
thin compatibility layer.

## Current Registry Tables

The registry is seeded by SQL files. Reapplying the database schema refreshes
these tables.

### `factor_definitions`

Seed source:

```text
scripts/bootstrap/factors/factor-definitions.json
scripts/bootstrap/factors/import-definitions.mjs
```

Used by:

- `src/backend/services/methodology/getMetricSystemRegistry.ts`
- methodology factor list

This table defines the broad factor catalog: key, name, category, description,
interpretation hint, polarity, active state, and display order.

### `factor_axis_definitions`

Seed source:

```text
db/factor_axis_definitions.sql
```

Used by:

- `src/backend/services/methodology/getMetricSystemRegistry.ts`
- methodology axis list

This table defines valid analytical evidence axes such as
`fundamentals_based`, `market_price`, `valuation`, `macro_linked`,
`etf_exposure`, and `narrative_implied`.

### `ticker_factor_feature_definitions`

Seed source:

```text
db/ticker_factor_feature_definitions.sql
```

Used by:

- factor feature calculation workflows
- `src/backend/services/methodology/getSignalSystemRegistry.ts`
- `src/backend/config/factors/active.ts`
- ticker factor signal and detail views
- vectorization and clustering inputs through feature usage flags

This is the central table for factor-owned metric features. Each row says:

- which model version owns the feature
- which `factor/axis/metric_key` the feature belongs to
- the persisted `feature_key`
- how the feature is computed
- which source table, metric, period type, column, process, and benchmark it
  reads
- whether it participates in comparison, macro contrast, vectorization, or UI
  vector display

Important convention:

```text
metric_key = reusable input metric
feature_key = factor-owned interpretation of that metric
```

The same metric can be reused by multiple factors, but feature rows should remain
factor/axis-owned unless the feature is deliberately modeled as a shared concept.

#### How feature definitions are used

Feature definitions are consumed before signal selection. They turn source time
series into rows in `ticker_factor_metric_features`.

The main path is:

```text
ticker_factor_feature_definitions
  -> resolveMetricFeatureInterpretation(...)
  -> buildTickerFactorMetricFeaturesForCik(...)
  -> ticker_factor_metric_features
```

`resolveMetricFeatureInterpretation` loads all active feature rows for a single
`factor/axis/metric_key` and returns a runtime config shaped as:

```text
factor
axis
metricKey
features[feature_key] = definition_payload
```

`buildTickerFactorMetricFeaturesForCik` then uses each feature definition to:

- resolve the source series from `definition_payload.series`
- optionally resolve denominator, counterpart, benchmark, or macro sources
- load the required source rows
- calculate one feature value per period
- normalize sign-sensitive values when sign-profile policy applies
- write the result to `ticker_factor_metric_features`

The output row keeps the factor-owned identity:

```text
ticker
cik
factor
axis
metric_key
feature_key
feature_value
period_end
effective_date
source_table
source_version
```

This means `ticker_factor_feature_definitions` is not just descriptive metadata.
It is executable calculation metadata. If the source table, metric key, period
type, source column, method, denominator, counterpart, or macro source is wrong,
the feature output will be missing or misleading.

The usage flags on this table also drive downstream behavior:

- `comparison`: feature can be used in peer or benchmark comparison logic
- `macro_contrast`: feature can be used with macro contrast logic
- `is_vector_eligible`: feature can be used in vectorization and clustering
- `show_in_vector`: feature should be exposed in vector-facing UI/debug views

`loadMetricFeatureUsageRules` reads these flags directly from
`ticker_factor_feature_definitions`.

### `ticker_factor_metric_display_definitions`

Seed source:

```text
db/ticker_factor_metric_display_definitions.sql
```

Used by:

- `src/backend/config/factors/active.ts`
- `src/backend/services/methodology/getSignalSystemRegistry.ts`
- ticker metric and signal UI labels

This table defines factor/axis/metric display metadata: metric label,
description, chart payload, display payload, order, and active state.

### `ticker_factor_axis_display_definitions`

Seed source:

```text
db/ticker_factor_axis_display_definitions.sql
```

Used by:

- `src/backend/config/factors/active.ts`
- `src/backend/services/methodology/getSignalSystemRegistry.ts`
- methodology factor concept view
- ticker factor UI grouping

This table defines factor/axis display metadata such as headline title, axis
label, chart defaults, baseline labels, feature order, and feature labels.

### `ticker_factor_signal_definitions`

Seed source:

```text
db/ticker_factor_signal_definitions.sql
```

Used by:

- `src/backend/services/sec/companyFacts/series/signal/buildTickerFactorSignals.ts`
- `src/backend/workflows/ticker-factor-signals/runTickerFactorSignalsWorkflow.ts`
- signal validation reports
- ticker signal detail views

This table defines factor-level signal selection. Rows contain:

- `signal_key`
- `signal_label`
- priority
- `selection_rules`
- `evidence_rules`
- `confidence_rules`

Signal definitions select an interpretation from already computed factor-owned
features. They should not duplicate feature calculation logic.

#### How signal definitions are used

Signal definitions are consumed after feature rows have already been generated.
They read `ticker_factor_metric_features`, select one signal per ticker and
factor/axis, then write `ticker_factor_signals`.

The main path is:

```text
ticker_factor_signal_definitions
  -> buildTickerFactorSignals(...)
  -> ticker_factor_metric_features
  -> ticker_factor_signals
```

`buildTickerFactorSignals` does four important things:

1. Loads active signal definitions for the requested `factor/axis`.
2. Loads the latest non-null feature rows from `ticker_factor_metric_features`.
3. Aggregates feature values by `feature_key`, using the median across observed
   metrics for that feature.
4. Walks signal definitions in priority order and selects the first definition
   whose `selection_rules` match.

`selection_rules` decide whether a signal applies. They can require all
conditions, any condition, or mark a fallback default. Conditions currently
compare feature aggregates such as:

```text
featureKey
operator
value
minObservedMetricCount
```

`evidence_rules` decide which feature rows should be copied into
`supporting_evidence`, `contradicting_evidence`, and contextual evidence fields
on the output signal row.

`confidence_rules` convert observed metric coverage into `signal_confidence`.
For example, a signal can require at least one observed metric and reach full
confidence only after multiple metrics contribute evidence.

The output row in `ticker_factor_signals` stores both the selected signal and a
copied evidence snapshot:

```text
signal_key
signal_label
signal_value
signal_confidence
primary_metric_key
primary_feature_key
primary_feature_value
observed_metric_count
total_metric_count
feature_values
supporting_evidence
contradicting_evidence
```

This copied evidence is intentional. It lets ticker detail, validation, and
market signal-combination views explain why a signal was selected without
re-running the full feature calculation.

Important boundary:

```text
ticker_factor_feature_definitions = compute feature rows
ticker_factor_signal_definitions = select and explain a signal from feature rows
```

If a new signal needs evidence that does not exist in
`ticker_factor_metric_features`, add or fix the feature definition first. Do not
encode feature calculation inside `ticker_factor_signal_definitions`.

## How Runtime Lookup Works Today

The current runtime path is:

```text
db/*.sql
  -> local PostgreSQL definition tables
  -> feature generation workflows
  -> ticker_factor_metric_features
  -> ticker_factor_signals
  -> API routes
  -> ticker, methodology, market, and validation views
```

The methodology page reads registry tables directly:

```text
factor_definitions
factor_axis_definitions
ticker_factor_feature_definitions
ticker_factor_metric_display_definitions
ticker_factor_axis_display_definitions
```

The ticker UI resolves display config through `active.ts`, which joins feature,
metric display, and axis display definitions for a specific
`factor/axis/metric`.

Signal generation reads `ticker_factor_signal_definitions`, then evaluates the
available feature outputs for each factor/axis.

## What Still Comes From `blueprints.ts`

`blueprints.ts` still owns calculation scope:

- which factors are active for a given axis
- which metric keys belong to that factor/axis
- which metric is primary
- whether a metric is `core`, `supporting`, or `context`
- sign-profile rules for selected metrics

This means adding SQL rows alone is not always enough. If a workflow still uses
`FACTOR_BLUEPRINTS` to decide scope, the metric must also be registered in
`src/backend/config/factors/blueprints.ts`.

In short:

```text
SQL definitions describe how a registered feature/signal/display should behave.
blueprints.ts still decides which factor/axis/metric scopes workflows visit.
```

## Adding Or Changing A Factor Metric Today

For a new factor metric, update the current hybrid registry in this order:

1. Add the metric key to the relevant shared metric registry if it is new.
   Examples include `src/shared/sec/metrics.ts`,
   `src/shared/factors/marketPriceMetrics.ts`,
   `src/shared/factors/valuationMetrics.ts`,
   `src/shared/factors/etfExposureMetrics.ts`, or
   `src/shared/factors/macroLinkedMetrics.ts`.

2. If it is SEC-derived, map SEC tags and metric behavior in the SEC Company
   Facts series layer.

3. Add or update the factor/axis/metric scope in
   `src/backend/config/factors/blueprints.ts`.

4. Add feature rows to `db/ticker_factor_feature_definitions.sql`.

5. Add metric display rows to
   `db/ticker_factor_metric_display_definitions.sql`.

6. Add or update axis display rows in
   `db/ticker_factor_axis_display_definitions.sql`.

7. Add or update signal rules in
   `db/ticker_factor_signal_definitions.sql`.

8. Reapply the schema or relevant SQL seed files, then run the needed data
   workflows so feature and signal output rows are regenerated.

9. Verify the methodology page, ticker detail page, signal detail API, and any
   vector or validation views that should consume the new feature.

## Migration Direction

The intended future state is:

```text
factor_definitions
factor_axis_definitions
factor/axis/metric scope definitions
ticker_factor_feature_definitions
ticker_factor_metric_display_definitions
ticker_factor_axis_display_definitions
ticker_factor_signal_definitions
```

In that future shape, SQL definitions should be able to answer both questions:

- What factor/axis/metric scopes exist?
- How does each scope compute, display, vectorize, and select signals?

Until then, keep SQL definition rows and `blueprints.ts` synchronized. If they
disagree, workflows may skip a metric that appears in methodology, or UI/runtime
code may fail to resolve display metadata for a metric that a workflow produced.

## Methodology Page Relationship

The methodology page is the user-facing explanation of this registry. It shows
the current factor concept view, signal system, confidence model, validation
notes, and file map.

It is not the full authoring manual. Developer authoring rules should live here
in `docs/developer/factor-definition-registry.md`, with methodology remaining an
inspectable product view of whatever the registry currently contains.
