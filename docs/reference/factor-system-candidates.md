# Factor System Candidates

This note tracks the factor target set and how each factor-axis should own
metric features. Shared metrics are allowed, but their factor-axis role must be
explicit in `src/backend/config/factors/blueprints.ts`.

## Layer Rule

```text
canonical metric series
  -> factor-axis-owned feature evidence
  -> factor-axis signal
  -> factor signal commentary
```

A metric is a reusable canonical input series. It may come from SEC enriched
metric rows, cross-source derived metrics, stored market prices, macro
observations, or future source layers.

A feature is factor-axis-owned numeric evidence computed from one metric or a
small set of related metrics. A signal is a factor-axis-owned state or label
selected by combining feature evidence.

The same metric can appear in multiple factors or axes. The same feature
meaning should not appear under multiple names. If a feature calculation has the
same source, method, scale, and accounting meaning across factors, use one
canonical feature key such as `turnaroundMomentum`.

Highly processed metrics, such as valuation multiples or shareholder yield, can
look one-to-one with a displayed feature. Keep them in the metric layer when the
value is reusable across factors, axes, signals, charts, or clustering; the
feature row records that a factor-axis has selected that metric as evidence.

## Current Feature Audit

Cross-factor duplicated feature meaning currently exists only for:

- `turnaroundMomentum`: growth and quality both use the same
  `is_turnaround`, `is_loss_narrowing`, and `is_deterioration` enriched inputs.

Other repeated feature definitions are currently inside one factor-axis and are
intended metric-level applications of that factor-axis feature vocabulary.

## Factor Candidates

| Factor | Status | Primary Evidence Direction |
|---|---|---|
| `growth` | implemented | revenue and operating metric growth features |
| `value` | candidate | valuation and mature earnings profile |
| `quality` | implemented | consistency, trend support, turnaround momentum |
| `income` | implemented | distributions and payout support |
| `size` | candidate | market capitalization and scale |
| `momentum` | candidate | price and estimate trend behavior |
| `high_beta` | candidate | market sensitivity and risk-on participation |
| `low_volatility` | candidate | lower realized volatility and stability |
| `defensive` | implemented | buffer, burden relief, and shock absorption |
| `cyclical` | candidate | economic expansion sensitivity |
| `consumer_linked` | candidate | consumer-linked market behavior and consumer basket exposure |
| `capex_cycle` | implemented | capital spending and investment cycle |
| `rate_sensitive` | candidate | interest-rate sensitivity |
| `credit_sensitive` | candidate | corporate credit-spread and funding-stress sensitivity |
| `duration_sensitive` | candidate | long-duration equity sensitivity |
| `liquidity_sensitive` | candidate | financial conditions sensitivity |
| `inflation_hedge` | candidate | pricing power and hard-asset linkage |
| `commodity_linked` | candidate | commodity price linkage |
| `energy_linked` | candidate | oil, gas, power, and energy system linkage |
| `china_exposure` | candidate | China demand, supply chain, or policy exposure |
| `reshoring_defense` | candidate | defense spending and supply-chain rebuilding |

## Metric Role Vocabulary

- `core`: the factor's main evidence metric.
- `supporting`: secondary factor evidence.
- `context`: cross-factor context used to interpret another metric family.

## Deferred Normalization Layers

Macro contrasts, benchmark comparisons, and clustering are downstream layers.
Temporary compatibility normalization can exist at read boundaries for stale
rows, but the clean long-term path is to recompute or migrate stored rows so
canonical feature keys are persisted directly.
