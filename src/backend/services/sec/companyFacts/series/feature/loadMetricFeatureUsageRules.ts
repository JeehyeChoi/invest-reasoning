import path from "node:path";
import { promises as fs } from "node:fs";

import type { FactorAxisKey } from "@/shared/factors/axes";
import type { FactorKey } from "@/shared/factors/factors";
import type { SecMetricKey } from "@/shared/sec/metrics";
import type {
  MetricFeatureDefinition,
  MetricFeatureInterpretationConfig,
} from "@/backend/services/sec/companyFacts/series/feature/types";

export type MetricFeatureUsageKind =
  | "comparison"
  | "macroContrast"
  | "clustering";

export type MetricFeatureUsageRule = {
  factor: FactorKey;
  axis: FactorAxisKey;
  metric_key: SecMetricKey;
  feature_key: string;
};

type LoadInput = {
  factor: FactorKey;
  axis: FactorAxisKey;
  metricKey?: SecMetricKey;
  usage: MetricFeatureUsageKind;
};

function buildAxisConfigPath(input: {
  factor: FactorKey;
  axis: FactorAxisKey;
}): string {
  return path.join(
    process.cwd(),
    "src",
    "backend",
    "config",
    "factors",
    input.factor,
    input.axis,
  );
}

function isFeatureEnabledForUsage(
  definition: MetricFeatureDefinition,
  usage: MetricFeatureUsageKind,
): boolean {
  return definition[usage] === true;
}

async function readInterpretationConfig(
  filePath: string,
): Promise<MetricFeatureInterpretationConfig | null> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as MetricFeatureInterpretationConfig;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return null;
    }

    throw error;
  }
}

export async function loadMetricFeatureUsageRules(
  input: LoadInput,
): Promise<MetricFeatureUsageRule[]> {
  const axisPath = buildAxisConfigPath(input);
  const metricNames = input.metricKey
    ? [input.metricKey]
    : (await fs.readdir(axisPath, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name as SecMetricKey);

  const rules: MetricFeatureUsageRule[] = [];

  for (const metricKey of metricNames) {
    const config = await readInterpretationConfig(
      path.join(axisPath, metricKey, "interpretation.json"),
    );

    if (!config) continue;

    for (const [featureKey, definition] of Object.entries(config.features)) {
      if (!isFeatureEnabledForUsage(definition, input.usage)) continue;

      rules.push({
        factor: config.factor,
        axis: config.axis,
        metric_key: config.metricKey,
        feature_key: featureKey,
      });
    }
  }

  return rules;
}
