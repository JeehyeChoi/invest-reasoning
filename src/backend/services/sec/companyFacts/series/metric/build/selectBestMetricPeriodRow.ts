import type { MetricBuildCandidate } from "./types";
import { toUtcDateMs } from "@/backend/services/sec/companyFacts/series/utils/dateKey";

export function selectBestMetricPeriodRow(input: {
  candidates: MetricBuildCandidate[];
}): MetricBuildCandidate | null {
  const { candidates } = input;

  if (candidates.length === 0) {
    return null;
  }

  return [...candidates].sort(compareCandidates)[0] ?? null;
}

function compareCandidates(a: MetricBuildCandidate, b: MetricBuildCandidate): number {
  const fitRank = comparePeriodFit(a, b);
  if (fitRank !== 0) return fitRank;

  const priorityRank = comparePriority(a, b);
  if (priorityRank !== 0) return priorityRank;

  const filedRank = compareFiled(a, b);
  if (filedRank !== 0) return filedRank;

  const alignmentRank = compareSecLabelAlignment(a, b);
  if (alignmentRank !== 0) return alignmentRank;

  const sourceRank = compareSourceKind(a, b);
  if (sourceRank !== 0) return sourceRank;

  const confidenceRank = b.resolvedPeriod.confidence - a.resolvedPeriod.confidence;
  if (confidenceRank !== 0) return confidenceRank;

  return String(b.accn ?? "").localeCompare(String(a.accn ?? ""));
}

function comparePeriodFit(a: MetricBuildCandidate, b: MetricBuildCandidate): number {
  const aScore = periodFitScore(a);
  const bScore = periodFitScore(b);

  if (aScore !== bScore) {
    return bScore - aScore;
  }

  return 0;
}

function periodFitScore(row: MetricBuildCandidate): number {
  let score = row.resolvedPeriod.fitScore * 100;

  if (
    row.resolvedPeriod.basis === "annual_window" ||
    row.resolvedPeriod.basis === "quarter_window"
  ) {
    score += 15;
  }

  switch (row.resolvedPeriod.windowMatchKind) {
    case "exact":
      score += 25;
      break;
    case "near":
      score += 15;
      break;
    case "partial":
      score += 5;
      break;
    case "outside":
      score -= 10;
      break;
    default:
      break;
  }

  score += row.resolvedPeriod.confidence * 20;
  return score;
}

function comparePriority(a: MetricBuildCandidate, b: MetricBuildCandidate): number {
  const aPriority = a.priority ?? Number.POSITIVE_INFINITY;
  const bPriority = b.priority ?? Number.POSITIVE_INFINITY;

  return aPriority - bPriority;
}

function compareFiled(a: MetricBuildCandidate, b: MetricBuildCandidate): number {
  return toDateMs(b.filed) - toDateMs(a.filed);
}

function compareSecLabelAlignment(a: MetricBuildCandidate, b: MetricBuildCandidate): number {
  return secLabelAlignmentRank(a) - secLabelAlignmentRank(b);
}

function secLabelAlignmentRank(row: MetricBuildCandidate): number {
  switch (row.resolvedPeriod.secLabelAlignment) {
    case "aligned":
      return 1;
    case "unknown":
      return 2;
    case "misaligned":
      return 3;
    default:
      return 99;
  }
}

function compareSourceKind(a: MetricBuildCandidate, b: MetricBuildCandidate): number {
  return sourceKindRank(a) - sourceKindRank(b);
}

function sourceKindRank(row: MetricBuildCandidate): number {
  switch (row.buildSourceKind) {
    case "raw_direct":
      return 1;
    case "segment_merged":
      return 2;
    case "other_merged":
      return 3;
    case "cumulative_derived":
      return 4;
    case "annual_derived":
      return 5;
    case "raw_partial":
      return 6;
    default:
      return 99;
  }
}

function toDateMs(value: string | Date | null | undefined): number {
  if (!value) return 0;

  const ms = toUtcDateMs(value);
  return ms ?? 0;
}
