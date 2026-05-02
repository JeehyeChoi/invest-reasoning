# Ticker Factor Metric Clustering

This project clusters companies from normalized factor-metric-signal vectors.

## Data Flow

```text
ticker_factor_metric_signals
  -> ticker_factor_metric_signal_positions
  -> ticker vector matrix
  -> ticker_factor_metric_clusters
  -> ticker_factor_metric_cluster_profiles
```

## Default Scope

- factor: `growth`
- axis: `fundamentals_based`
- comparison set: `usa/all`
- normalization: `z_score`
- clustering method: deterministic `kmeans`
- default cluster count: automatic silhouette-based selection

## Vector Construction

By default, each `signal_key` becomes one feature dimension after aggregating
the ticker's metric-level values by median. The clustering service reads the
latest position row per ticker and feature, filters sparse features, imputes
missing values to neutral `0`, clips extreme z-scores, and drops tickers with
low vector coverage. Metric-level dimensions remain available through
`metric_signal` vector mode.

## Why Positions Are Used

The pipeline consumes `ticker_factor_metric_signal_positions` instead of raw
signals so clustering works on normalized values. `z_score` is preferred because
it preserves magnitude; `percentile` and `sign` are available for more compressed
experiments.

## Output Tables

- `ticker_factor_metric_clusters`: one row per ticker per run, including cluster
  id, label, coverage, and distance to centroid.
- `ticker_factor_metric_cluster_profiles`: one row per cluster per run,
  including centroid JSON and the strongest distinguishing features.

## Internal API

```http
POST /api/internal/ticker-factor-metric-clustering
```

Example body:

```json
{
  "factor": "growth",
  "axis": "fundamentals_based",
  "comparisonSetType": "usa",
  "comparisonSetKey": "all",
  "normalizationMethod": "z_score",
  "clusterCount": 6
}
```

## Market Cluster Overview API

```http
GET /api/market/cluster/overview
```

Returns the latest saved clustering run, cluster profiles, and ticker rows for
the market cluster overview page.
