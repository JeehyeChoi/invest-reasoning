import path from "node:path";
import { promises as fs } from "node:fs";

import type { FactorKey, FactorScoreAxisKey } from "@/shared/factors/factors";
import type { SecMetricKey } from "@/shared/sec/metrics";
import type { MetricSignalInterpretationConfig } from "@/backend/services/sec/companyFacts/series/signal/types";

type ResolveInput = {
  factor: FactorKey;
  axis: FactorScoreAxisKey;
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

export async function resolveMetricSignalInterpretation(
  input: ResolveInput,
): Promise<MetricSignalInterpretationConfig> {
  const filePath = buildInterpretationPath(input);
  const raw = await fs.readFile(filePath, "utf-8");
  const config = JSON.parse(raw) as MetricSignalInterpretationConfig;

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
