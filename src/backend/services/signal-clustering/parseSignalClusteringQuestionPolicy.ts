import type { FactorAxisKey } from "@/shared/factors/axes";
import type { FactorKey } from "@/shared/factors/factors";
import {
  SIGNAL_CLUSTERING_QUESTION_POLICY_STATUSES,
  type SignalClusteringQuestionPolicy,
  type SignalClusteringQuestionPolicyStatus,
} from "@/shared/market/signalClusteringPolicy";

export type SignalClusteringQuestionPolicySource = {
  factor: FactorKey;
  axis: FactorAxisKey;
  status: unknown;
  reason: unknown;
};

export function isSignalClusteringQuestionPolicyStatus(
  value: unknown,
): value is SignalClusteringQuestionPolicyStatus {
  return (
    typeof value === "string" &&
    (SIGNAL_CLUSTERING_QUESTION_POLICY_STATUSES as readonly string[]).includes(
      value,
    )
  );
}

export function parseSignalClusteringQuestionPolicy(
  input: SignalClusteringQuestionPolicySource,
): SignalClusteringQuestionPolicy | null {
  if (!isSignalClusteringQuestionPolicyStatus(input.status)) {
    return null;
  }

  return {
    factor: input.factor,
    axis: input.axis,
    status: input.status,
    reason: typeof input.reason === "string" ? input.reason : "",
  };
}

export function parseSignalClusteringQuestionPolicies(
  sources: SignalClusteringQuestionPolicySource[],
): SignalClusteringQuestionPolicy[] {
  return sources.flatMap((source) => {
    const policy = parseSignalClusteringQuestionPolicy(source);

    return policy ? [policy] : [];
  });
}
