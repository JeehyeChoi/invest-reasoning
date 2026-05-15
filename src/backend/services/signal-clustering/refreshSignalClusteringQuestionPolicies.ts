import { db } from "@/backend/config/db";
import {
  getFactorSignalValidationReport,
  type FactorSignalValidationRow,
} from "@/backend/services/sec/companyFacts/series/signal/getFactorSignalValidationReport";
import type { FactorAxisKey } from "@/shared/factors/axes";
import type { FactorKey } from "@/shared/factors/factors";
import type {
  SignalClusteringQuestionPolicy,
  SignalClusteringQuestionPolicyStatus,
} from "@/shared/market/signalClusteringPolicy";
import {
  DEFAULT_UNIVERSE_KEYS,
  type UniverseKey,
} from "@/shared/universe/universes";

export type RefreshSignalClusteringQuestionPoliciesInput = {
  factor?: FactorKey;
  axis?: FactorAxisKey;
  asOfDate?: string;
  universeKeys?: UniverseKey[];
};

export type RefreshSignalClusteringQuestionPoliciesResult = {
  generatedAt: string;
  universeKeys: UniverseKey[];
  updated: number;
  policies: SignalClusteringQuestionPolicy[];
  counts: Record<SignalClusteringQuestionPolicyStatus, number>;
};

type QuestionState = {
  factor: FactorKey;
  axis: FactorAxisKey;
  selectedCount: number;
  noSignalCount: number;
  mixedCount: number;
  directionalCount: number;
  noSignalShare: number;
  directionalShare: number;
  dominantLabel: string | null;
  dominantShare: number;
  entropy: number | null;
};

export async function refreshSignalClusteringQuestionPolicies(
  input: RefreshSignalClusteringQuestionPoliciesInput = {},
): Promise<RefreshSignalClusteringQuestionPoliciesResult> {
  const universeKeys = input.universeKeys?.length
    ? input.universeKeys
    : [...DEFAULT_UNIVERSE_KEYS];
  const report = await getFactorSignalValidationReport({
    factor: input.factor,
    axis: input.axis,
    asOfDate: input.asOfDate,
    universeKeys,
  });
  const policies = buildQuestionStates({
    rows: report.rows,
    universeTickerCount: report.totals.universeTickerCount,
  }).map(buildPolicyFromQuestionState);

  for (const policy of policies) {
    await db.query(
      `
      INSERT INTO public.ticker_signal_clustering_question_policies (
        model_key,
        model_version,
        factor,
        axis,
        status,
        reason,
        source,
        validation_payload,
        refreshed_at,
        is_active
      )
      VALUES (
        'factor_signal',
        'v0',
        $1,
        $2,
        $3,
        $4,
        'signal_validation',
        $5::jsonb,
        $6::timestamptz,
        true
      )
      ON CONFLICT (model_key, model_version, factor, axis)
      DO UPDATE SET
        status = EXCLUDED.status,
        reason = EXCLUDED.reason,
        source = EXCLUDED.source,
        validation_payload = EXCLUDED.validation_payload,
        refreshed_at = EXCLUDED.refreshed_at,
        is_active = true,
        updated_at = now()
      `,
      [
        policy.factor,
        policy.axis,
        policy.status,
        policy.reason,
        JSON.stringify({
          universeKeys,
        }),
        report.generatedAt,
      ],
    );
  }

  return {
    generatedAt: report.generatedAt,
    universeKeys,
    updated: policies.length,
    policies,
    counts: policies.reduce(
      (counts, policy) => ({
        ...counts,
        [policy.status]: counts[policy.status] + 1,
      }),
      { use: 0, review: 0, hold: 0 },
    ),
  };
}

function buildQuestionStates(input: {
  rows: FactorSignalValidationRow[];
  universeTickerCount: number;
}): QuestionState[] {
  const rowsByQuestion = new Map<string, FactorSignalValidationRow[]>();

  for (const row of input.rows) {
    const key = `${row.factor}:${row.axis}`;
    rowsByQuestion.set(key, [...(rowsByQuestion.get(key) ?? []), row]);
  }

  return [...rowsByQuestion.values()].flatMap((rows) => {
    const firstRow = rows[0];
    if (!firstRow) return [];

    const selectedCount = rows.reduce((sum, row) => sum + row.count, 0);
    const mixedCount = rows
      .filter(isMixedSignal)
      .reduce((sum, row) => sum + row.count, 0);
    const directionalCount = selectedCount - mixedCount;
    const noSignalCount = Math.max(
      0,
      input.universeTickerCount - selectedCount,
    );
    const denominator = Math.max(input.universeTickerCount, 1);
    const dominantSignal =
      rows
        .filter((row) => row.count > 0)
        .sort((a, b) => b.count - a.count)[0] ?? null;
    const stateCounts = [
      ...rows.filter((row) => row.count > 0).map((row) => row.count),
      ...(noSignalCount > 0 ? [noSignalCount] : []),
    ];

    return [
      {
        factor: firstRow.factor,
        axis: firstRow.axis,
        selectedCount,
        noSignalCount,
        mixedCount,
        directionalCount,
        noSignalShare: noSignalCount / denominator,
        directionalShare: directionalCount / denominator,
        dominantLabel: dominantSignal?.signalLabel ?? null,
        dominantShare: dominantSignal ? dominantSignal.count / denominator : 0,
        entropy: calcNormalizedEntropy(stateCounts),
      },
    ];
  });
}

function buildPolicyFromQuestionState(
  state: QuestionState,
): SignalClusteringQuestionPolicy {
  const reasons = buildPolicyReasons(state);
  const status: SignalClusteringQuestionPolicyStatus =
    state.noSignalShare > 0.45 || state.directionalShare < 0.1
      ? "hold"
      : reasons.length > 1 ||
          state.noSignalShare > 0.2 ||
          state.dominantShare > 0.6
        ? "review"
        : "use";

  return {
    factor: state.factor,
    axis: state.axis,
    status,
    reason:
      reasons.length > 0
        ? reasons.join("; ")
        : "Usable coverage and answer diversity based on signal validation refresh.",
  };
}

function buildPolicyReasons(state: QuestionState): string[] {
  const reasons: string[] = [];

  if (state.noSignalShare > 0.35) {
    reasons.push(
      `many tickers have no selected answer (${formatPercent(
        state.noSignalShare,
      )})`,
    );
  } else if (state.noSignalShare > 0.2) {
    reasons.push(
      `coverage/readiness gap (${formatPercent(state.noSignalShare)} no signal)`,
    );
  }

  if (state.dominantShare > 0.6) {
    reasons.push(
      `one answer dominates the question (${state.dominantLabel ?? "-"} ${formatPercent(
        state.dominantShare,
      )})`,
    );
  }

  if (state.directionalShare < 0.25) {
    reasons.push(
      `few directional answers for active Jaccard signals (${formatPercent(
        state.directionalShare,
      )})`,
    );
  }

  if (state.entropy !== null && state.entropy < 0.45) {
    reasons.push(
      `low answer diversity (${state.entropy.toFixed(3)} normalized entropy)`,
    );
  }

  return reasons;
}

function isMixedSignal(row: FactorSignalValidationRow) {
  return row.signalKey.includes("mixed") || row.mixedShare === 1;
}

function calcNormalizedEntropy(counts: number[]) {
  const total = counts.reduce((sum, count) => sum + count, 0);
  const nonZeroCounts = counts.filter((count) => count > 0);

  if (total <= 0 || nonZeroCounts.length <= 1) return null;

  const entropy = nonZeroCounts.reduce((sum, count) => {
    const p = count / total;
    return sum - p * Math.log(p);
  }, 0);

  return entropy / Math.log(nonZeroCounts.length);
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}
