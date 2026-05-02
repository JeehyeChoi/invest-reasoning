// src/backend/services/sec/companyFacts/series/metric/build/buildInstantMetricSeries.ts

import type {
  BuildInstantMetricSeriesInput,
  MetricBuildCandidate,
} from "@/backend/services/sec/companyFacts/series/metric/build/types";

export function buildInstantMetricSeries(
  _input: BuildInstantMetricSeriesInput,
): MetricBuildCandidate[] {
  // Instant metric series is intentionally disabled for now.
  // We are focusing on flow series first, and skipping instant rows
  // removes a major per-company bottleneck without affecting the
  // current flow-oriented workflow.
  return [];
}
