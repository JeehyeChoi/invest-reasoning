import type { FactorAxisKey } from "@/shared/factors/axes";
import type { FactorKey } from "@/shared/factors/factors";
import type { SignalClusteringQuestionPolicy } from "@/shared/market/signalClusteringPolicy";
import type { UniverseKey } from "@/shared/universe/universes";

export type FactorSignalValidationReport = {
  asOfDate: string | null;
  universeKeys: UniverseKey[];
  generatedAt: string;
  totals: {
    factorAxisCount: number;
    selectedSignalCount: number;
    universeTickerCount: number;
    mixedCount: number;
    noSignalCount: number;
  };
  questionPolicies: SignalClusteringQuestionPolicy[];
  rows: FactorSignalValidationRow[];
};

export type FactorSignalValidationRow = {
  factor: FactorKey;
  axis: FactorAxisKey;
  signalKey: string;
  signalLabel: string;
  priority: number;
  count: number;
  share: number | null;
  mixedShare: number | null;
  noSignalShare: number | null;
  medianDriver: number | null;
  p10Driver: number | null;
  p90Driver: number | null;
  avgAllMatched: number | null;
  avgAllTotal: number | null;
  avgAnyMatched: number | null;
  avgAnyTotal: number | null;
  minMetricsMetShare: number | null;
  shadowedCandidateCount: number;
  topSector: string | null;
  topSectorShare: number | null;
  universeCounts: Record<string, number>;
  examples: {
    representative: string[];
    threshold: string[];
    outliers: string[];
  };
};

export type FetchFactorSignalValidationInput = {
  factor?: FactorKey;
  axis?: FactorAxisKey;
  asOfDate?: string;
  universeKeys?: UniverseKey[];
};

export async function fetchFactorSignalValidation(
  input: FetchFactorSignalValidationInput = {},
): Promise<FactorSignalValidationReport> {
  const params = new URLSearchParams();
  if (input.factor) params.set("factor", input.factor);
  if (input.axis) params.set("axis", input.axis);
  if (input.asOfDate) params.set("asOfDate", input.asOfDate);
  if (input.universeKeys?.length) {
    params.set("universes", input.universeKeys.join(","));
  }

  const query = params.toString();
  const response = await fetch(
    `/api/signal-validation${query ? `?${query}` : ""}`,
  );

  if (!response.ok) {
    throw new Error("Failed to fetch factor signal validation.");
  }

  return response.json();
}

export type RefreshSignalClusteringPolicyResult = {
  ok: true;
  generatedAt: string;
  universeKeys: UniverseKey[];
  updated: number;
  policies: SignalClusteringQuestionPolicy[];
  counts: Record<SignalClusteringQuestionPolicy["status"], number>;
};

export async function refreshSignalClusteringPolicies(
  input: FetchFactorSignalValidationInput = {},
): Promise<RefreshSignalClusteringPolicyResult> {
  const response = await fetch("/api/signal-validation", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      factor: input.factor,
      axis: input.axis,
      asOfDate: input.asOfDate,
      universeKeys: input.universeKeys,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to refresh signal clustering policies.");
  }

  return response.json();
}
