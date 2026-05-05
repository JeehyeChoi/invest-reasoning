#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const [factor, axis, metricKey] = process.argv.slice(2);

if (!factor || !axis || !metricKey) {
  console.error(
    "Usage: node scripts/factors/check-feature-definition-ownership.mjs <factor> <axis> <metric_key>",
  );
  process.exit(2);
}

const configRoot = path.join(
  process.cwd(),
  "src",
  "backend",
  "config",
  "factors",
);

function walk(dir) {
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(entryPath);
    return entry.name === "interpretation.json" ? [entryPath] : [];
  });
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
      lookback: definition.lookback ?? null,
      method: definition.method ?? "direct",
      signProfilePolicy: definition.signProfilePolicy ?? null,
      series: definition.series
        ? {
            table: definition.series.table ?? null,
            version: definition.series.version ?? null,
            metricKey: definition.series.metricKey ?? null,
            periodType: definition.series.periodType ?? null,
          }
        : null,
    }),
  );
}

const requestedFile = path.join(configRoot, factor, axis, metricKey, "interpretation.json");

if (!fs.existsSync(requestedFile)) {
  console.error(`missing interpretation config: ${requestedFile}`);
  process.exit(1);
}

const requestedConfig = JSON.parse(fs.readFileSync(requestedFile, "utf8"));
const sharedConceptFeatureKeys = new Set(["turnaroundMomentum"]);
const requestedDefinitions = Object.entries(requestedConfig.features ?? {})
  .map(([featureKey, definition]) => ({
    featureKey,
    identity: featureDefinitionIdentity(definition),
  }));

const allDefinitions = new Map();

for (const file of walk(configRoot)) {
  const config = JSON.parse(fs.readFileSync(file, "utf8"));

  for (const [featureKey, definition] of Object.entries(config.features ?? {})) {
    const identity = featureDefinitionIdentity(definition);
    const entries = allDefinitions.get(identity) ?? [];
    entries.push({
      factor: config.factor,
      axis: config.axis,
      metricKey: config.metricKey,
      featureKey,
    });
    allDefinitions.set(identity, entries);
  }
}

const conflicts = requestedDefinitions.flatMap((requestedDefinition) => {
  return (allDefinitions.get(requestedDefinition.identity) ?? []).filter(
    (entry) =>
      entry.factor !== factor &&
      !sharedConceptFeatureKeys.has(requestedDefinition.featureKey),
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

console.log("ok");
