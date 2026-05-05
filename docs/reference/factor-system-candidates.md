# Factor System Candidates

This note tracks the 20-factor target set and how each factor should own metric
features. Shared SEC metrics are allowed, but their factor role must be explicit
in `src/backend/config/factors/blueprints.ts`.

## Layer Rule

```text
SEC metric series
  -> enriched metric state
  -> factor-owned metric features
  -> factor signal
  -> factor signal commentary
```

The same SEC metric can appear in multiple factors. The same feature meaning
should not appear under multiple names. If a feature calculation has the same
source, method, scale, and accounting meaning across factors, use one canonical
feature key such as `turnaroundMomentum`.

## Current Feature Audit

Cross-factor duplicated feature meaning currently exists only for:

- `turnaroundMomentum`: growth and quality both use the same
  `is_turnaround`, `is_loss_narrowing`, and `is_deterioration` enriched inputs.

Other repeated feature definitions are currently inside one factor and are
intended metric-level applications of that factor's feature vocabulary.

## 20 Factor Candidates

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
| `consumer_strength` | candidate | consumer demand and discretionary exposure |
| `capex_cycle` | implemented | capital spending and investment cycle |
| `rate_sensitive` | candidate | interest-rate sensitivity |
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

Feature baselines, feature positions, macro contrasts, and clustering are
downstream normalized layers. Temporary compatibility normalization can exist at
read boundaries for stale rows, but the clean long-term path is to recompute or
migrate stored rows so canonical feature keys are persisted directly.
