import type { FactorAxisKey } from "@/shared/factors/axes";
import type { FactorKey } from "@/shared/factors/factors";
import {
  buildSignalClusteringQuestionKey,
  type SignalClusteringQuestionPolicy,
} from "@/shared/market/signalClusteringPolicy";

export function buildSignalClusteringQuestionPolicyMap(
  policies: readonly SignalClusteringQuestionPolicy[],
): Map<string, SignalClusteringQuestionPolicy> {
  return new Map(
    policies.map((policy) => [
      buildSignalClusteringQuestionKey(policy.factor, policy.axis),
      policy,
    ]),
  );
}

export function getSignalClusteringQuestionPolicyFromMap(input: {
  policiesByQuestion: Map<string, SignalClusteringQuestionPolicy>;
  factor: FactorKey;
  axis: FactorAxisKey;
}): SignalClusteringQuestionPolicy | null {
  return (
    input.policiesByQuestion.get(
      buildSignalClusteringQuestionKey(input.factor, input.axis),
    ) ?? null
  );
}
