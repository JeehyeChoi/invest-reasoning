#!/usr/bin/env node
import pg from "pg";

const [factor, axis, metricKey] = process.argv.slice(2);

if (!factor || !axis || !metricKey) {
  console.error(
    "Usage: node scripts/factors/check-feature-definition-ownership.mjs <factor> <axis> <metric_key>",
  );
  process.exit(2);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(2);
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, stable(child)]),
    );
  }

  return value;
}

function featureDefinitionIdentity(definition) {
  return JSON.stringify(
    stable({
      source: definition.source ?? null,
      sources: definition.sources ?? null,
      reference: definition.reference ?? null,
      denominator: definition.denominator
        ? {
            table: definition.denominator.table ?? null,
            version: definition.denominator.version ?? null,
            processKey: definition.denominator.processKey ?? null,
            metricKey: definition.denominator.metricKey ?? null,
            periodType: definition.denominator.periodType ?? null,
            source: definition.denominator.source ?? null,
          }
        : null,
      counterpart: definition.counterpart
        ? {
            table: definition.counterpart.table ?? null,
            version: definition.counterpart.version ?? null,
            processKey: definition.counterpart.processKey ?? null,
            metricKey: definition.counterpart.metricKey ?? null,
            periodType: definition.counterpart.periodType ?? null,
            source: definition.counterpart.source ?? null,
          }
        : null,
      lookback: definition.lookback ?? null,
      benchmark: definition.benchmark ?? null,
      benchmarks: definition.benchmarks ?? null,
      macroSource: definition.macroSource ?? null,
      stressSource: definition.stressSource ?? null,
      skip: definition.skip ?? null,
      method: definition.method ?? "direct",
      signProfilePolicy: definition.signProfilePolicy ?? null,
      series: definition.series
        ? {
            table: definition.series.table ?? null,
            version: definition.series.version ?? null,
            processKey: definition.series.processKey ?? null,
            metricKey: definition.series.metricKey ?? null,
            periodType: definition.series.periodType ?? null,
          }
        : null,
    }),
  );
}

const nearDuplicateMetricGroups = [
  new Set(["price_to_basic_ttm_eps", "price_to_diluted_ttm_eps"]),
  new Set(["basic_ttm_eps_growth", "diluted_ttm_eps_growth"]),
  new Set(["market_capitalization", "log_market_capitalization"]),
  new Set(["dividend_yield", "buyback_yield", "shareholder_yield"]),
  new Set(["dividend_yield_share", "buyback_yield_share"]),
];

const nearDuplicateFeatureGroups = [
  new Set([
    "defensive/fundamentals_based/long_term_debt/defensiveBurdenTrendRelief",
    "rate_sensitive/fundamentals_based/long_term_debt/rateLongTermDebtPosition",
  ]),
  new Set([
    "value/fundamentals_based/liabilities/liabilitiesToAssets",
    "value/fundamentals_based/stockholders_equity/bookEquityToAssets",
  ]),
];

function nearDuplicateMetricGroupFor(metricKey) {
  return (
    nearDuplicateMetricGroups.find((group) => group.has(metricKey)) ?? null
  );
}

function nearDuplicateFeatureGroupFor(row) {
  const key = `${row.factor}/${row.axis}/${row.metric_key}/${row.feature_key}`;

  return nearDuplicateFeatureGroups.find((group) => group.has(key)) ?? null;
}

const pool = new pg.Pool({ connectionString: databaseUrl });

try {
  const result = await pool.query(
    `
    SELECT
      factor,
      axis,
      metric_key,
      feature_key,
      is_vector_eligible,
      definition_payload
    FROM public.ticker_factor_feature_definitions
    WHERE model_key = 'factor_feature'
      AND model_version = 'v0'
      AND is_active = true
    `,
  );

  const requestedRows = result.rows.filter(
    (row) =>
      row.factor === factor &&
      row.axis === axis &&
      row.metric_key === metricKey,
  );

  if (requestedRows.length === 0) {
    console.error(`missing feature definition rows: ${factor}/${axis}/${metricKey}`);
    process.exit(1);
  }

  const allDefinitions = new Map();

  for (const row of result.rows) {
    const identity = featureDefinitionIdentity(row.definition_payload ?? {});
    const entries = allDefinitions.get(identity) ?? [];
    entries.push({
      factor: row.factor,
      axis: row.axis,
      metricKey: row.metric_key,
      featureKey: row.feature_key,
      vectorEligible: row.is_vector_eligible,
    });
    allDefinitions.set(identity, entries);
  }

  const conflicts = requestedRows.flatMap((requestedRow) => {
    const identity = featureDefinitionIdentity(requestedRow.definition_payload ?? {});
    return (allDefinitions.get(identity) ?? []).filter(
      (entry) =>
        entry.factor !== factor &&
        requestedRow.is_vector_eligible &&
        entry.vectorEligible,
    );
  });

  if (conflicts.length > 0) {
    for (const conflict of conflicts) {
      console.error(
        `feature definition reused by another factor: ${conflict.factor}/${conflict.axis}/${conflict.metricKey}/${conflict.featureKey}`,
      );
    }
    process.exit(1);
  }

  const nearDuplicateMetricGroup = nearDuplicateMetricGroupFor(metricKey);
  if (nearDuplicateMetricGroup) {
    const vectorEligiblePeers = result.rows.filter(
      (row) =>
        row.factor === factor &&
        row.axis === axis &&
        nearDuplicateMetricGroup.has(row.metric_key) &&
        row.is_vector_eligible,
    );

    if (vectorEligiblePeers.length > 1) {
      console.error(
        `near-duplicate metrics are both vector eligible in ${factor}/${axis}: ${vectorEligiblePeers
          .map((row) => row.metric_key)
          .join(", ")}`,
      );
      process.exit(1);
    }
  }

  for (const requestedRow of requestedRows) {
    const nearDuplicateFeatureGroup = nearDuplicateFeatureGroupFor(requestedRow);
    if (!nearDuplicateFeatureGroup) continue;

    const vectorEligiblePeers = result.rows.filter(
      (row) =>
        nearDuplicateFeatureGroup.has(
          `${row.factor}/${row.axis}/${row.metric_key}/${row.feature_key}`,
        ) && row.is_vector_eligible,
    );

    if (vectorEligiblePeers.length > 1) {
      console.error(
        `near-duplicate features are both vector eligible: ${vectorEligiblePeers
          .map(
            (row) =>
              `${row.factor}/${row.axis}/${row.metric_key}/${row.feature_key}`,
          )
          .join(", ")}`,
      );
      process.exit(1);
    }
  }

  console.log("ok");
} finally {
  await pool.end();
}
