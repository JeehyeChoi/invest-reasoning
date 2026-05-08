# Ticker Vectorization

Vectorization is the boundary between stored factor data and downstream market
analysis. Clustering, signal cohort analysis, and future archetype analysis
should consume ticker vectors from this layer instead of loading feature or
signal tables directly.

## Core Sources

- `ticker_factor_metric_features`: raw metric feature values.
- `ticker_factor_signals`: selected factor signal rows.

## Vector Modes

### `factor_signal`

Source policy: `signal_activation`

Each selected `factor.axis.signal.signal_key` becomes a vector dimension. The
selected signal is encoded as `1`; inactive signals are imputed as `0`.

This mode is appropriate for:

- cross-factor market archetype clustering
- factor-level signal cohort summaries
- market overview pages that should read like interpreted states

### `metric_feature`

Source policy: `feature_value`

Each enabled `factor.axis.metric.feature` component becomes a vector dimension.
The dimension list is controlled by `interpretation.json` feature usage flags,
read through `loadMetricFeatureUsageRules`.

This mode is appropriate for:

- within-signal feature subtype analysis
- threshold review
- component distribution analysis

### Reserved Policies

Peer or benchmark-relative vectors should be introduced as a separate source
policy when the benchmark comparison layer is rebuilt.

## Current Implementation

- `src/backend/services/ticker-vectorization/types.ts`
- `src/backend/services/ticker-vectorization/buildTickerVectorMatrix.ts`

The clustering service should call `buildTickerVectorMatrix` and keep clustering
logic separate from source loading, dimension selection, missing value handling,
and normalization.

## Analysis Model

```text
single-factor signal view
  = signal cohort analysis
  = group by selected signal

within-signal feature view
  = feature component distribution/subtype analysis
  = metric_feature vectors filtered to one signal cohort

multi-factor market view
  = market archetype clustering
  = cross-factor factor_signal vectors
```
