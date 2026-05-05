import path from "node:path";
import { promises as fs } from "node:fs";

import type { FactorKey } from "@/shared/factors/factors";
import type { FactorAxisKey } from "@/shared/factors/axes";
import type { SecMetricKey } from "@/shared/sec/metrics";
import type { MetricFeatureInterpretationConfig } from "@/backend/services/sec/companyFacts/series/feature/types";

type ResolveInput = {
  factor: FactorKey;
  axis: FactorAxisKey;
  metricKey: SecMetricKey;
};

function buildInterpretationPath(input: ResolveInput): string {
  return path.join(
    process.cwd(),
    "src",
    "backend",
    "config",
    "factors",
    input.factor,
    input.axis,
    input.metricKey,
    "interpretation.json",
  );
}

export async function resolveMetricFeatureInterpretation(
  input: ResolveInput,
): Promise<MetricFeatureInterpretationConfig> {
  const filePath = buildInterpretationPath(input);
  const raw = await fs.readFile(filePath, "utf-8");
  const config = JSON.parse(raw) as MetricFeatureInterpretationConfig;

  if (
    config.factor !== input.factor ||
    config.axis !== input.axis ||
    config.metricKey !== input.metricKey
  ) {
    throw new Error(
      `Interpretation config identity mismatch: ${filePath}`,
    );
  }

  return config;
}
