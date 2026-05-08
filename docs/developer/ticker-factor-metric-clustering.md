# Ticker Factor Feature Clustering

This service clusters companies from ticker vectors built by the vectorization
layer. The default operational vector is a signal activation vector: each
selected factor signal becomes an active dimension for the ticker. Metric
feature values remain available as a separate vector mode.

## Data Flow

```text
ticker_factor_signals
  -> ticker-vectorization/buildTickerVectorMatrix
  -> ticker_factor_feature_clusters
  -> ticker_factor_feature_cluster_profiles
```

## Default Scope

- factor: `growth`
- axis: `fundamentals_based`
- vector mode: `factor_signal`
- vector source policy: `signal_activation`
- normalization: `none`
- clustering method: deterministic `kmeans`
- default cluster count: automatic silhouette-based selection

## Vector Construction

By default, each `factor.axis.signal.signal_key` becomes one vector dimension.
The vectorization service reads the latest selected signal row per ticker and
factor/axis, stores active signals as `1`, imputes inactive signals to neutral
`0`, and returns a matrix for downstream clustering.

Detailed vector source ownership lives in
`docs/developer/ticker-vectorization.md`.

## Vector Source Policies

The current operational model uses `signal_activation` vectors from
`ticker_factor_signals`. `feature_value` vectors from
`ticker_factor_metric_features` remain available through `metric_feature` mode.
Peer or benchmark-relative vectors should be introduced as a separate model when
the benchmark comparison layer is rebuilt.

## Output Tables

- `ticker_factor_feature_clusters`: one row per ticker per run, including cluster
  id, label, coverage, and distance to centroid.
- `ticker_factor_feature_cluster_profiles`: one row per cluster per run,
  including centroid JSON and the strongest distinguishing features.

## Product Interpretation

- Single-factor signal views should usually be treated as signal cohort
  analysis, because each factor currently selects one signal per ticker. The
  service groups identical single-factor `factor_signal` vectors directly when
  `clusterCount` is not explicitly requested.
- Within-signal feature analysis should use `metric_feature` vectors filtered to
  a signal cohort when the question is threshold or subtype discovery.
- Multi-factor market archetype clustering should use cross-factor
  `factor_signal` vectors.

## Internal API

```http
POST /api/internal/ticker-factor-metric-clustering
```

Example body:

```json
{
  "vectorMode": "factor_signal",
  "vectorSourcePolicy": "signal_activation",
  "normalizationMethod": "none",
  "runScope": "both"
}
```

`runScope` controls whether the workflow persists single-factor signal cohorts,
the cross-factor signal-vector market archetype run, or both:

- `single`: one run per `factor.axis`, grouped into signal cohorts.
- `combined`: one cross-factor run using all available factor signal dimensions.
- `both`: persists the combined run plus single-factor signal cohorts.

## Market Cluster Overview API

```http
GET /api/market/cluster/overview
```

Returns the latest saved clustering run, cluster profiles, and ticker rows for
the market cluster overview page.
