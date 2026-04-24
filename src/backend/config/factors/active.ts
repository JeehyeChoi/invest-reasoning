import path from "node:path";
import { promises as fs } from "node:fs";

import type { FactorKey, FactorScoreAxisKey } from "@/backend/schemas/factor";
import type { SecMetricKey } from "@/backend/schemas/sec/metrics";

export type FactorModelFamily =
  | "heuristic"
  | "quantitative"
  | "modeling";

export type FactorConfigResolveInput = {
  factor: FactorKey;
  axis: FactorScoreAxisKey;
  metricKey: SecMetricKey;
};

export const ACTIVE_FACTOR_MODEL: FactorModelFamily = "heuristic";

export const FACTOR_MODEL_OVERRIDES: Partial<
  Record<string, FactorModelFamily>
> = {
  // "growth:fundamentals_based:revenue": "quantitative",
};

function buildFactorOverrideKey(input: FactorConfigResolveInput): string {
  return `${input.factor}:${input.axis}:${input.metricKey}`;
}

export function resolveFactorModel(
  input: FactorConfigResolveInput,
): FactorModelFamily {
  const key = buildFactorOverrideKey(input);
  return FACTOR_MODEL_OVERRIDES[key] ?? ACTIVE_FACTOR_MODEL;
}

function buildFactorConfigPath(
  input: FactorConfigResolveInput,
  model: FactorModelFamily,
): string {
  return path.join(
    process.cwd(),
    "src",
    "backend",
    "config",
    "factors",
    input.factor,
    input.axis,
    input.metricKey,
    `${model}.json`,
  );
}

function buildFactorDisplayPath(input: FactorConfigResolveInput): string {
  return path.join(
    process.cwd(),
    "src",
    "backend",
    "config",
    "factors",
    input.factor,
    input.axis,
    input.metricKey,
    "display.json",
  );
}

export async function resolveFactorDisplay(input: FactorConfigResolveInput) {
  const filePath = buildFactorDisplayPath(input);
  const raw = await fs.readFile(filePath, "utf-8");

  return JSON.parse(raw);
}

export async function resolveFactorConfigForModel(
  input: FactorConfigResolveInput,
  model: FactorModelFamily,
) {
  const filePath = buildFactorConfigPath(input, model);
  const raw = await fs.readFile(filePath, "utf-8");

  return {
    model,
    config: JSON.parse(raw),
  };
}

export async function resolveFactorConfig(
  input: FactorConfigResolveInput,
) {
  const model = resolveFactorModel(input);
  const filePath = buildFactorConfigPath(input, model);

  const raw = await fs.readFile(filePath, "utf-8");

  return {
    model,
    config: JSON.parse(raw),
  };
}
