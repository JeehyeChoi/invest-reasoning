import type { FactorAxisKey } from "@/shared/factors/axes";
import type { FactorKey } from "@/shared/factors/factors";

// Deprecated compatibility export for stale dev-server module graphs.
// Signal clustering policy is stored in ticker_signal_clustering_question_policies.
export const SIGNAL_CLUSTERING_POLICY_DISPLAY_PAYLOAD_KEY =
  "signalClusteringPolicy";

export const SIGNAL_CLUSTERING_QUESTION_POLICY_STATUSES = [
  "use",
  "review",
  "hold",
] as const;

export type SignalClusteringQuestionPolicyStatus = "use" | "review" | "hold";

export type SignalClusteringQuestionPolicy = {
  factor: FactorKey;
  axis: FactorAxisKey;
  status: SignalClusteringQuestionPolicyStatus;
  reason: string;
};

export function buildSignalClusteringQuestionKey(
  factor: string,
  axis: string,
) {
  return `${factor}:${axis}`;
}
