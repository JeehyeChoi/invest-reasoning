import fs from "node:fs";
import vm from "node:vm";

const [file, factor, axis, metricKey] = process.argv.slice(2);

if (!file || !factor || !axis || !metricKey) {
  console.error("Usage: node scripts/factors/check-blueprint-metric.mjs <file> <factor> <axis> <metric_key>");
  process.exit(2);
}

const source = fs.readFileSync(file, "utf8");

const match = source.match(
  /export\s+const\s+FACTOR_BLUEPRINTS\s*:\s*FactorBlueprintMap\s*=\s*({[\s\S]*?});/
);

if (!match) {
  console.error("FACTOR_BLUEPRINTS object literal not found");
  process.exit(1);
}

const objectLiteral = match[1];

const emptyAxisBlueprint = {
  metricKeys: [],
  primaryMetricKey: null,
};
const emptyFactorBlueprint = {
  fundamentals_based: emptyAxisBlueprint,
};

const sandbox = {
  blueprints: undefined,
  EMPTY_FACTOR_AXIS_BLUEPRINT: emptyAxisBlueprint,
  EMPTY_FACTOR_BLUEPRINT: emptyFactorBlueprint,
};
vm.createContext(sandbox);

try {
  vm.runInContext(`blueprints = ${objectLiteral}`, sandbox);
} catch (error) {
  console.error(
    `Unable to evaluate FACTOR_BLUEPRINTS object literal: ${error.message}`,
  );
  process.exit(1);
}

const blueprints = sandbox.blueprints;

const exists =
  Array.isArray(blueprints?.[factor]?.[axis]?.metricKeys) &&
  blueprints[factor][axis].metricKeys.includes(metricKey);

process.exit(exists ? 0 : 1);
