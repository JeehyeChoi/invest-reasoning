# Naming Policy

Naming is used to encode responsibility, data lineage, and execution context,
not just identification.

## Core Principle

Prefer explicit names over short names.

A file name should answer:

- what is being processed
- where the data comes from
- which pipeline stage or layer owns it
- what unit of data it operates on
- how it decides or transforms data, when that matters

## Naming Formula

Backend service files should generally follow:

```text
<verb><SourceOrDomain><Object><Qualifier><Unit>.ts
```

Examples:

```ts
buildCompanyFactsMetricSeriesForCik.ts
deriveAnnualMetricSeriesFromCompleteQuarters.ts
selectBestCompanyFactMetricPeriodRow.ts
upsertCompanyFactMetricSeriesRows.ts
```

## Verb Roles

Use the first verb to signal the module's role.

### `fetch`

External or frontend-facing data retrieval.

Examples:

```ts
fetchTickerOverview.ts
fetchTickerMetricSeries.ts
fetchRecentFilings.ts
```

### `get`

Internal backend read or assembly logic. May combine multiple sources.

Examples:

```ts
getTickerOverview.ts
getTickerMetricSeries.ts
getMetricSystemRegistry.ts
```

### `load`

Load existing stored state with no transformation intent.

Examples:

```ts
loadCompanyFiscalProfile.ts
loadCompanyMetricSignProfiles.ts
loadCompanyFactsStateMap.ts
```

### `build`

Construct a new derived structure.

Examples:

```ts
buildFlowMetricSeries.ts
buildInstantMetricSeries.ts
buildCompanyFiscalProfileForCik.ts
```

### `derive`

Compute an inferred value through rules or logic.

Examples:

```ts
deriveAnnualFromCompleteQuarters.ts
deriveCompanyMetricSignProfilesForCik.ts
```

### `resolve`

Decide among candidates or finalize an interpretation.

Examples:

```ts
resolvePeriod.ts
resolveQuarterPeriod.ts
resolveMetricSignalInterpretation.ts
resolveTickerMetadata.ts
```

### `classify`

Assign a categorical label to raw or intermediate data.

Examples:

```ts
classifyDuration.ts
classifyForm.ts
classifyFrame.ts
```

### `select`

Choose the best candidate from a set.

Example:

```ts
selectBestMetricPeriodRow.ts
```

### `insert` / `upsert`

Persist data to storage.

Examples:

```ts
insertCompanyFactTagSeriesRows.ts
upsertCompanyFactMetricSeriesRows.ts
```

### `run`

Workflow orchestration entrypoint.

Examples:

```ts
runDataPipelineRefreshWorkflow.ts
runTickerFactorMetricSignalsWorkflow.ts
```

## Data Lineage

Names should reflect the data pipeline stage.

Example:

```text
sec/companyFacts/series/metric/buildCompanyFactsMetricSeriesForCik.ts
```

This encodes:

```text
SEC source
-> Company Facts dataset
-> series layer
-> metric transformation
-> company-level CIK unit
```

## Unit Awareness

Include the unit of operation when it clarifies ownership or scope.

Common unit markers:

- `ForCik`
- `ByTicker`
- `Rows`
- `Series`
- `Profile`
- `Snapshot`
- `Registry`

Examples:

```ts
buildCompanyFiscalProfileForCik.ts
getTickerCikMap.ts
upsertCompanyFactMetricSeriesRows.ts
```

## Layer Patterns

Use these patterns by layer:

```text
Backend service: <verb><Domain><Object><Qualifier>.ts
Workflow:        run<Domain><WorkflowName>Workflow.ts
Workflow step:   <verb><Object>Step.ts
Frontend fetch:  fetch<Resource>.ts
React component: <Domain><Role>.tsx
```

React component suffixes should describe UI role:

- `Panel`
- `Page`
- `Section`
- `Chart`
- `Primitives`

## Casing

Use casing by context:

| Context | Style | Example |
| --- | --- | --- |
| TypeScript files | camelCase | `buildMetricSeries.ts` |
| React components | PascalCase | `TickerHeaderPanel.tsx` |
| API routes | kebab-case | `market-status` |
| Workflow folders | kebab-case | `data-pipeline-refresh` |
| Config and database identifiers | snake_case | `operating_cash_flow` |

## Avoid Vague Names

Avoid generic names that hide responsibility:

```text
data.ts
processor.ts
handler.ts
manager.ts
helper.ts
utils.ts
processData.ts
calculate.ts
```

Prefer concrete operation names:

```ts
classifyDuration.ts
resolveQuarterPeriod.ts
mergeSegmentedQuarterFlows.ts
validatePeriodIntegrity.ts
```

## Config Names

Config uses domain-driven identifiers rather than code-style names.

Example:

```text
growth/fundamentals_based/revenue/display.json
growth/fundamentals_based/revenue/interpretation.json
```

Config naming should prioritize domain clarity over developer convention.

## Summary

Names should describe:

- responsibility
- data lineage
- processing stage
- execution context
- unit of operation

You should be able to infer what a file does, where it belongs, and how it fits
into the data pipeline by reading its name.
