import fs from "node:fs";

const [file, factor, axis, metricKey] = process.argv.slice(2);

if (!file || !factor || !axis || !metricKey) {
  console.error(
    "Usage: node scripts/factors/check-blueprint-metric.mjs <file> <factor> <axis> <metric_key>",
  );
  process.exit(2);
}

const source = fs.readFileSync(file, "utf8");
const metricArrays = readConstMetricArrays(source);
const blueprintsBlock = findAssignedObjectBlock(source, "FACTOR_BLUEPRINTS");

if (!blueprintsBlock) {
  console.error("FACTOR_BLUEPRINTS object literal not found");
  process.exit(1);
}

const factorBlock = findPropertyObjectBlock(blueprintsBlock, factor);
const axisBlock = factorBlock ? findPropertyObjectBlock(factorBlock, axis) : null;

if (!axisBlock) process.exit(1);

const hasDirectMetric = axisBlock.includes(JSON.stringify(metricKey));
const hasSpreadMetric = [...metricArrays.entries()].some(
  ([arrayName, metricKeys]) =>
    axisBlock.includes(`...${arrayName}`) && metricKeys.has(metricKey),
);

process.exit(hasDirectMetric || hasSpreadMetric ? 0 : 1);

function readConstMetricArrays(text) {
  const arrays = new Map();
  const regex = /const\s+([A-Z0-9_]+)\s*=\s*\[([\s\S]*?)\]\s*as\s+const/g;

  for (const match of text.matchAll(regex)) {
    const [, name, body] = match;
    arrays.set(name, new Set([...body.matchAll(/"([^"]+)"/g)].map((m) => m[1])));
  }

  return arrays;
}

function findAssignedObjectBlock(text, name) {
  const nameIndex = text.indexOf(name);
  if (nameIndex < 0) return null;

  const equalsIndex = text.indexOf("=", nameIndex);
  if (equalsIndex < 0) return null;

  const openBraceIndex = text.indexOf("{", equalsIndex);
  if (openBraceIndex < 0) return null;

  return readBalancedBlock(text, openBraceIndex, "{", "}");
}

function findPropertyObjectBlock(text, propertyName) {
  const regex = new RegExp(`(^|[^A-Za-z0-9_$])${escapeRegex(propertyName)}\\s*:`, "g");

  for (const match of text.matchAll(regex)) {
    const colonIndex = match.index + match[0].lastIndexOf(":");
    const openBraceIndex = text.indexOf("{", colonIndex);
    const between = text.slice(colonIndex + 1, openBraceIndex).trim();

    if (openBraceIndex >= 0 && between === "") {
      return readBalancedBlock(text, openBraceIndex, "{", "}");
    }
  }

  return null;
}

function readBalancedBlock(text, openIndex, openToken, closeToken) {
  let depth = 0;
  let quote = null;
  let escaping = false;

  for (let index = openIndex; index < text.length; index += 1) {
    const char = text[index];

    if (quote) {
      if (escaping) {
        escaping = false;
      } else if (char === "\\") {
        escaping = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === "\"" || char === "'" || char === "`") {
      quote = char;
      continue;
    }

    if (char === openToken) depth += 1;
    if (char === closeToken) depth -= 1;

    if (depth === 0) return text.slice(openIndex, index + 1);
  }

  return null;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
