import fs from "node:fs";
import vm from "node:vm";

const [file, factor, axis, metricKey] = process.argv.slice(2);

if (!file || !factor || !axis || !metricKey) {
  console.error("Usage: node scripts/check-blueprint-metric.mjs <file> <factor> <axis> <metric_key>");
  process.exit(2);
}

const source = fs.readFileSync(file, "utf8");

const match = source.match(
  /export\s+const\s+FACTOR_BLUEPRINTS\s*:\s*FactorBlueprintMap\s*=\s*({[\s\S]*?});/
);

if (!match) process.exit(1);

const objectLiteral = match[1];

const sandbox = {};
vm.createContext(sandbox);

vm.runInContext(`blueprints = ${objectLiteral}`, sandbox);

const blueprints = sandbox.blueprints;

const exists =
  Array.isArray(blueprints?.[factor]?.[axis]?.metricKeys) &&
  blueprints[factor][axis].metricKeys.includes(metricKey);

process.exit(exists ? 0 : 1);
