import path from "node:path";
import { promises as fs } from "node:fs";

import type { FactorKey, FactorScoreAxisKey } from "@/shared/factors/factors";
import type { FactorScoringMethod } from "@/shared/factors/methods";
import type { SecMetricKey } from "@/shared/sec/metrics";

export const ACTIVE_FACTOR_SCORING_METHOD: FactorScoringMethod = "heuristic";

export type FactorConfigResolveInput = {
  factor: FactorKey;
  axis: FactorScoreAxisKey;
  metricKey: SecMetricKey;
};

export const FACTOR_SCORING_METHOD_OVERRIDES: Partial<
  Record<string, FactorScoringMethod>
> = {
  // "growth:fundamentals_based:revenue": "quantitative",
};

function buildFactorOverrideKey(input: FactorConfigResolveInput): string {
  return `${input.factor}:${input.axis}:${input.metricKey}`;
}

export function resolveFactorScoringMethod(
  input: FactorConfigResolveInput,
): FactorScoringMethod {
  const key = buildFactorOverrideKey(input);
  return FACTOR_SCORING_METHOD_OVERRIDES[key] ?? ACTIVE_FACTOR_SCORING_METHOD;
}

function buildFactorConfigPath(
  input: FactorConfigResolveInput,
  method: FactorScoringMethod,
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
    `${method}.json`,
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

function buildFactorAxisDisplayPath(input: FactorConfigResolveInput): string {
  return path.join(
    process.cwd(),
    "src",
    "backend",
    "config",
    "factors",
    input.factor,
    input.axis,
    "display.common.json",
  );
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

async function readJsonIfExists(filePath: string) {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (error) {
    if (isMissingFileError(error)) {
      return null;
    }

    throw error;
  }
}

function mergeFactorDisplay(commonDisplay: any, metricDisplay: any) {
  const merged = {
    ...(commonDisplay ?? {}),
    ...(metricDisplay ?? {}),
    chart: {
      ...(commonDisplay?.chart ?? {}),
      ...(metricDisplay?.chart ?? {}),
    },
    signalLabels: {
      ...(commonDisplay?.signalLabels ?? {}),
      ...(metricDisplay?.signalLabels ?? {}),
    },
    baselineLabels: {
      ...(commonDisplay?.baselineLabels ?? {}),
      ...(metricDisplay?.baselineLabels ?? {}),
    },
  };

  return {
    ...merged,
    // Temporary compatibility for ticker detail panels while the UI migrates
    // from score metrics to interpretation signals.
    metricOrder: merged.metricOrder ?? merged.signalOrder ?? [],
    metricLabels: merged.metricLabels ?? merged.signalLabels ?? {},
  };
}

export async function resolveFactorDisplay(input: FactorConfigResolveInput) {
  const [commonDisplay, metricDisplay] = await Promise.all([
    readJsonIfExists(buildFactorAxisDisplayPath(input)),
    readJsonIfExists(buildFactorDisplayPath(input)),
  ]);

  if (!commonDisplay && !metricDisplay) {
    throw new Error(
      `Factor display config not found: ${input.factor}/${input.axis}/${input.metricKey}`,
    );
  }

  return mergeFactorDisplay(commonDisplay, metricDisplay);
}

export async function resolveFactorConfigForMethod(
  input: FactorConfigResolveInput,
  method: FactorScoringMethod,
) {
  const filePath = buildFactorConfigPath(input, method);
  const raw = await fs.readFile(filePath, "utf-8");

  return {
    method,
    config: JSON.parse(raw),
  };
}

export async function resolveFactorConfig(
  input: FactorConfigResolveInput,
) {
  const method = resolveFactorScoringMethod(input);
  const filePath = buildFactorConfigPath(input, method);

  const raw = await fs.readFile(filePath, "utf-8");

  return {
    method,
    config: JSON.parse(raw),
  };
}
