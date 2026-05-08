import path from "node:path";
import { promises as fs } from "node:fs";

import type { FactorKey } from "@/shared/factors/factors";
import type { FactorAxisKey } from "@/shared/factors/axes";
import type {
  MetricFeatureInterpretationConfig,
  MetricFeatureMetricKey,
} from "@/backend/services/sec/companyFacts/series/feature/types";

type ResolveInput = {
  factor: FactorKey;
  axis: FactorAxisKey;
  metricKey: MetricFeatureMetricKey;
};

const interpretationConfigCache = new Map<
  string,
  Promise<MetricFeatureInterpretationConfig>
>();

function buildInterpretationCacheKey(input: ResolveInput): string {
  return `${input.factor}:${input.axis}:${input.metricKey}`;
}

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
  const cacheKey = buildInterpretationCacheKey(input);
  const cached = interpretationConfigCache.get(cacheKey);
  if (cached) return cached;

  const configPromise = readMetricFeatureInterpretation(input);
  interpretationConfigCache.set(cacheKey, configPromise);

  return configPromise;
}

async function readMetricFeatureInterpretation(
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
