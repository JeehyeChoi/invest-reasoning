# Signal Percolation Validation Roadmap

## Purpose

The signal percolation timeline currently describes market structure. It shows
how exact signal-set groups connect, fragment, and form a market core under an
IDF-weighted Jaccard similarity graph.

This is useful as a descriptive tool, but it is not yet validated as a trading
signal, risk signal, or forward-looking market regime indicator.

The next goal is to connect the structural outputs to observable outcomes.

## Current Status

Completed:

1. Quarter-end signal percolation timelines support `all`, `fundamentals`, and
   `price_linked` axis scopes.
2. Markdown export includes method definitions, caveats, core size context,
   core identity turnover, selected boundary diagnostics, and cached forward
   return validation.
3. Core identity turnover is calculated versus the previous quarter and the
   same quarter one year earlier.
4. Watch and regime-change candidate bands are derived from top-five YoY
   turnover and top-ten weighted YoY turnover thresholds.
5. Forward return validation is stored in
   `ticker_signal_core_forward_returns`.
6. Timeline snapshots are stored in
   `ticker_signal_percolation_timeline_snapshots`.
7. Forward validation reads cached table data rather than calculating during
   screen render or Markdown export.
8. Forward validation uses the shared benchmark ETF registry at
   `src/shared/market/signalCoreForwardBenchmarks.ts`.
9. The forward validation panel appears for any axis scope when the selected
   snapshot is a validation event and cached data exists.
10. Signal percolation timeline refresh now computes forward returns for every
    timeline snapshot whose percolation analysis is available, not only watch
    or regime-change candidate events.
11. Non-event snapshots are not substituted with the nearest validation event.
    They should be read from their own cached forward-return rows once the
    timeline refresh has backfilled them.
12. The data pipeline exposes an explicit clear-before-run option for signal
    percolation timeline refresh. Normal runs refresh/upsert; clear runs delete
    selected axis-scope timeline and forward-return rows before rebuilding.

Not completed:

1. Finish historical backfill runs for all axis scopes after policy changes.
2. Event versus non-event baseline comparison UI/API.
3. Core member versus non-core member forward outcome comparison.
4. Forward realized volatility and max drawdown validation.
5. Market Structural Cohesion Index and cohesion change-rate metrics.
6. Cross-axis event quality comparison across `all`, `fundamentals`, and
   `price_linked`.
7. Core membership persistence, entrants, and exits.
8. Boundary ticker analysis.
9. External macro regime comparison.
10. State transition graph and transition speed modeling.

## Current Decision

State transition modeling remains an important direction, but Market Structural
Cohesion Index work should come first. Transition labels need stable structural
state variables, and cohesion level, cohesion change, and fragmentation
acceleration are better inputs than turnover alone.

The immediate work should remain focused on validating whether candidate events
behave differently from non-events and whether core members behave differently
from relevant benchmark and non-core cohorts.

Forward returns are now computed for every timeline snapshot with available
percolation analysis during timeline refresh. Event and change-warning status
should remain labels used for cohort comparison, not the only snapshots that
receive validation data.

Before transition modeling, add cohesion features that can serve as state
inputs:

- cohesion level
- quarter-over-quarter cohesion change
- year-over-year cohesion change
- cohesion acceleration
- fragmentation acceleration
- boundary-pressure change

After event quality and cohesion features are established, transition work can
model:

- `P(next_state | current_state)`
- transition speed
- turnover acceleration
- fragmentation acceleration
- defensive concentration acceleration
- latent regime labels inferred from observed signal states

## Current Method Summary

At each snapshot date:

1. Build ticker-level selected signal sets from `ticker_factor_signals`.
2. Collapse tickers with the same active directional signal set into exact
   combination groups.
3. Build group-to-group similarity edges using IDF-weighted Jaccard similarity.
4. Raise the similarity threshold and track graph fragmentation.
5. Select the peak-fragmentation split using the finite-component second moment.
6. Summarize:
   - largest component size before the split
   - largest piece after the split
   - market core baseline signals
   - boundary connecting signals

## Important Definitions

- **Ticker**: one company/security in the active universe.
- **Signal**: one selected factor-axis state, such as
  `quality.fundamentals_based.cash_backed_earnings`.
- **Signal set**: active directional signals attached to a ticker at a snapshot
  date.
- **Group**: an exact signal-set combination. Multiple tickers can belong to one
  group if they have the same active signal set.
- **Graph node**: one exact signal-set group, not one ticker.
- **Edge**: a similarity link between two groups.
- **Largest component**: the largest connected group set at a threshold.
- **Second moment**: finite-component second moment after excluding the largest
  component. It emphasizes medium-sized fragments.
- **Boundary connecting signals**: signals shared by removed cross-piece edges
  whose endpoints land in different post-split pieces.

## Core Interpretation Limitation

The current tool answers:

> What does the market signal network look like?

It does not yet answer:

> What should we do with this structure?

For example, if the latest all-axis core moves from `930 -> 350`, this may be a
warning signal, normal fragmentation, or a setup for recovery. The current
timeline alone does not distinguish those cases.

## Priority Validation Questions

### 1. Forward Return Validation

Attach forward benchmark returns to validation event snapshots:

- forward 1M return
- forward 3M return
- forward 6M return
- forward 12M return
- forward realized volatility, not yet implemented
- max drawdown after snapshot, not yet implemented

Benchmark ETF comparisons are now driven from the shared benchmark registry,
including broad market, style, sector, rate-sensitive, credit, commodity, and
factor ETFs.

Important next step:

- finish full historical refresh/backfill for all selected axis scopes
- compare event outcomes against non-event outcomes
- compare core members against non-core members

Example output:

```text
snapshot_date | axis_scope | largest_share | second_moment | boundary_edges | fwd_3m | fwd_6m | fwd_12m
```

This is the fastest way to test whether the percolation statistics are only
descriptive or have market-state value.

### 2. Event Versus Non-Event Baseline

Validation events should not be interpreted in isolation. A candidate event is
only useful if its forward behavior differs from ordinary snapshots.

Needed cohorts:

- validation events
- non-event quarter-end snapshots
- matched non-events by year or market regime
- recent non-events for current-market comparison

Suggested output:

```text
axis_scope | cohort | count | fwd_1m_mean | fwd_3m_mean | fwd_6m_mean | fwd_12m_mean | hit_rate
```

### 3. Market Structural Cohesion Index

Define a compact structural index from the saved percolation timeline so that
state-transition work has stable inputs beyond identity turnover.

Goal:

> Measure how strongly the market is tied together by one common signal
> structure, while penalizing cases where that apparent core is fragile,
> fragmenting, or rapidly changing identity.

Available first-pass inputs from current snapshots:

- `largestBeforeSize / groupCount` as pre-split core cohesion
- `largestAfterSize / largestBeforeSize` as split retention
- finite-component second moment as fragmentation pressure
- boundary edge count and removed edge count as boundary pressure
- peak split threshold as similarity tightness
- top-ten weighted turnover versus previous quarter and same quarter last year

MVP raw derived metrics:

```text
largest_share = largestBeforeSize / groupCount
split_severity = 1 - largestAfterSize / largestBeforeSize
fragmentation_intensity = secondMoment / groupCount
boundary_density = boundaryEdges / largestBeforeSize
turnover_yoy = top10_weighted_yoy
turnover_qoq = top10_weighted_prev
```

MVP component meanings:

| Component | Formula | Interpretation |
| --- | --- | --- |
| Core cohesion | `largest_share` | Larger pre-split core means the market is more tied together. |
| Split fragility | `split_severity` | Larger split damage means the apparent core was fragile. |
| Fragmentation pressure | normalized `fragmentation_intensity` | Larger medium-piece pressure means more sub-regime formation. |
| Identity instability | normalized `turnover_yoy` | Larger YoY core identity change means higher regime-transition risk. |
| Boundary instability | normalized `boundary_density` | More disappearing boundary edges per core node means weaker connectors. |

Proposed MVP index:

```text
cohesion_index =
  + 0.40 * core_cohesion
  - 0.20 * split_fragility
  - 0.20 * fragmentation_pressure
  - 0.15 * identity_instability
  - 0.05 * boundary_instability
```

Use percentile or z-score normalization inside each axis scope before combining
components, because fundamentals, price-linked, and all-axis timelines have
different natural ranges.

Important change-rate features:

```text
cohesion_level
d_cohesion_qoq
d_cohesion_yoy
cohesion_acceleration
fragmentation_acceleration
boundary_pressure_change
cohesion_persistence
```

The change rate may matter more than the absolute value. A stable low-cohesion
market and a rapidly falling cohesion market should not be treated as the same
state.

Suggested state labels:

| Condition | Candidate label |
| --- | --- |
| High cohesion + low turnover | stable common regime |
| High cohesion + high turnover | macro shock / regime reset |
| Low cohesion + low turnover | fragmented but stable multi-regime |
| Low cohesion + high turnover | unstable transition / rotation market |

Calculate the index separately by lens:

- `fundamentals_cohesion`
- `price_linked_cohesion`
- `all_axes_cohesion`

Lens disagreement should be interpreted directly:

- fundamentals stable + price unstable = price rotation while financial core is
  stable
- fundamentals unstable + price unstable = broader structural risk
- fundamentals weak + price reconnecting = possible recovery candidate
- all-axis cohesion falling = market narrative dispersion

First-pass implementation can use existing stored timeline summaries. A fuller
network-level index would require saving additional graph statistics such as
pre-split edge count, average edge similarity, component count distribution, and
possibly edge density.

MVP implementation order:

1. Read timeline snapshots and derive raw metrics per axis scope.
2. Normalize component values within the selected axis scope.
3. Calculate `cohesion_index`.
4. Calculate QoQ, YoY, acceleration, and persistence.
5. Add state labels.
6. Add Markdown summary first; add frontend chart after the definition settles.
7. Validate against forward returns, volatility, drawdown, and breadth.

### 4. Core Versus Non-Core Outcomes

The current validation calculates returns for tickers inside the pre-split
largest component.

Next, compare:

- core members
- non-core tickers
- post-break largest piece members
- post-break smaller-piece members
- benchmark ETFs

This answers whether the market core itself has distinct forward behavior.

### 5. Quarter-End Timeline

Quarter-end timeline support has been added. Keep the caveat that quarter-end
snapshots can still miss intra-quarter shocks.

Current policy:

- use quarter-end snapshots for the selected lookback
- keep `Latest` as a separate mixed snapshot

### 6. Core Membership Tracking

The current saved timeline stores summary statistics but not full membership.
To analyze ticker-level implications, store or recompute:

- tickers in the pre-split largest component
- tickers outside the core
- tickers in post-break pieces
- core entrants
- core exits
- persistent core members

This enables questions such as:

- Which stocks enter the market core before rallies?
- Which stocks leave before drawdowns?
- Are peripheral stocks higher-risk or higher-return?

### 7. Boundary Ticker Analysis

Boundary signals are currently edge-level summaries. For investment use, they
need to be tied back to tickers.

Potential outputs:

- groups on removed cross-piece edges
- tickers in those groups
- tickers most frequently appearing on boundary edges
- sector/industry/market-cap profile of boundary tickers

This may identify securities sitting between market regimes.

### 8. External Macro Regime Comparison

Connect timeline statistics to external variables:

| External variable | Question |
| --- | --- |
| 10Y Treasury yield | Do rate regime shifts align with threshold or core changes? |
| VIX | Does elevated volatility share track market stress? |
| Credit spreads | Do credit-sensitive boundary signals precede stress? |
| ISM manufacturing | Do cyclical ETF exposure signals track the real economy? |

This helps distinguish independent signal-network information from restating
known macro variables.

### 9. Lens Disagreement Analysis

Compare axis scopes directly.

Important disagreement example:

- fundamentals lens shows high fragmentation
- all-axis lens shows strong cohesion

Possible interpretations:

- price co-movement is masking fundamental dispersion
- IDF weighting behaves differently across lenses
- the lenses are measuring genuinely different market structures

Suggested output:

```text
snapshot_date | all_largest_share | fundamentals_largest_share | price_largest_share | spread
```

Large spreads should be flagged as analysis targets.

## Data Quality Notes

### Groups Versus Tickers

If `Groups` is close to `Tickers`, that is not necessarily an error. It means
most tickers have unique exact signal combinations. Those unique groups can
still connect into a large component through similarity edges.

### Latest Snapshot Caveat

The latest snapshot is not a complete calendar-year or quarter-end snapshot.

- SEC-derived axes should be interpreted as available through the latest
  completed reporting cycle.
- price-linked axes may reflect newer market data.

This matters when interpreting current-year snapshots.

### Boundary Lift Caution

Boundary signal lift near `1.0x` means boundary edges are not very different
from the pre-split core baseline. Strong interpretation requires:

- repeated appearance across dates
- repeated appearance across lenses
- or validation against forward outcomes

## Suggested Implementation Order

1. Finish historical forward-return backfill for all selected axis scopes.
2. Build event versus non-event forward validation.
3. Add Market Structural Cohesion Index and cohesion change-rate metrics.
4. Add core versus non-core forward outcome comparison.
5. Add forward realized volatility and max drawdown.
6. Add lens disagreement summary.
7. Add core membership storage or recomputation.
8. Add boundary ticker analysis.
9. Connect structural metrics to external macro variables.
10. Build state transition graph using event labels, turnover, cohesion, and
    fragmentation features.
11. Add transition speed and acceleration metrics.
12. Explore latent regime inference.

## Working Principle

Treat the current percolation timeline as a market structure map first.

Only after forward-return, volatility, and membership-transition validation
should it be promoted to a decision-support signal.
