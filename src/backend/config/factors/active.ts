import path from "node:path";
import { promises as fs } from "node:fs";

import type { FactorKey } from "@/shared/factors/factors";
import type { FactorAxisKey } from "@/shared/factors/axes";
import type { SecMetricKey } from "@/shared/sec/metrics";

export type FactorConfigResolveInput = {
  factor: FactorKey;
  axis: FactorAxisKey;
  metricKey: SecMetricKey;
};

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
    featureLabels: {
      ...(commonDisplay?.featureLabels ?? {}),
      ...(metricDisplay?.featureLabels ?? {}),
    },
    baselineLabels: {
      ...(commonDisplay?.baselineLabels ?? {}),
      ...(metricDisplay?.baselineLabels ?? {}),
    },
  };

  return {
    ...merged,
    metricOrder: merged.metricOrder ?? merged.featureOrder ?? [],
    metricLabels: merged.metricLabels ?? merged.featureLabels ?? {},
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
