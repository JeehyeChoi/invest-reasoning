import { db } from "@/backend/config/db";
import type { FactorAxisKey } from "@/shared/factors/axes";
import type { FactorKey } from "@/shared/factors/factors";
import type {
  TickerOverviewFactorSignalCandidate,
  TickerSignalDetail,
} from "@/shared/tickers/tickerOverview";

type SignalDefinitionRow = {
  signal_key: string;
  signal_label: string;
  signal_description: string | null;
  priority: number | string | null;
  selection_rules: unknown;
};

type SignalRow = {
  model_key: string | null;
  model_version: string | null;
  signal_method: string | null;
  signal_period_end: Date | string | null;
  signal_effective_date: Date | string | null;
  signal_key: string | null;
  signal_label: string | null;
  signal_value: number | string | null;
  signal_confidence: number | string | null;
  primary_metric_key: string | null;
  primary_feature_key: string | null;
  primary_feature_value: number | string | null;
  observed_metric_count: number | string | null;
  total_metric_count: number | string | null;
  feature_values: unknown;
  supporting_evidence: unknown;
  contradicting_evidence: unknown;
};

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

export async function getTickerSignalDetail(input: {
  ticker: string;
  factor: FactorKey;
  axis: FactorAxisKey;
}): Promise<TickerSignalDetail | null> {
  const ticker = normalizeTicker(input.ticker);
  if (!ticker) return null;

  const definitionsQuery = `
    SELECT
      signal_key,
      signal_label,
      signal_description,
      priority,
      selection_rules
    FROM public.ticker_factor_signal_definitions
    WHERE factor = $1
      AND axis = $2
      AND is_active = true
    ORDER BY priority, signal_key
  `;
  const signalQuery = `
    WITH request_identity AS (
      SELECT cik
      FROM public.ticker_identities
      WHERE ticker = $1
      LIMIT 1
    )
    SELECT
      model_key,
      model_version,
      signal_method,
      signal_period_end,
      signal_effective_date,
      signal_key,
      signal_label,
      signal_value,
      signal_confidence,
      primary_metric_key,
      primary_feature_key,
      primary_feature_value,
      observed_metric_count,
      total_metric_count,
      feature_values,
      supporting_evidence,
      contradicting_evidence
    FROM public.ticker_factor_signals
    WHERE factor = $2
      AND axis = $3
      AND (
        cik = (SELECT cik FROM request_identity)
        OR ticker = $1
      )
    ORDER BY signal_effective_date DESC, signal_period_end DESC
    LIMIT 1
  `;

  const [definitionsResult, signalResult] = await Promise.all([
    db.query<SignalDefinitionRow>(definitionsQuery, [input.factor, input.axis]),
    db.query<SignalRow>(signalQuery, [ticker, input.factor, input.axis]),
  ]);
  const signalRow = signalResult.rows[0];
  const candidates = definitionsResult.rows.map((row) => ({
    signalKey: row.signal_key,
    signalLabel: row.signal_label,
    signalDescription: row.signal_description,
    priority: toNullableNumber(row.priority),
    selectionRulesSummary: summarizeSelectionRules(row.selection_rules),
    selectionRules: row.selection_rules,
  })) satisfies TickerOverviewFactorSignalCandidate[];

  return {
    ticker,
    factor: input.factor,
    axis: input.axis,
    signal: {
      factor: input.factor,
      axis: input.axis,
      modelKey: signalRow?.model_key ?? null,
      modelVersion: signalRow?.model_version ?? null,
      signalMethod: signalRow?.signal_method ?? null,
      signalPeriodEnd: signalRow?.signal_period_end
        ? toIsoDate(signalRow.signal_period_end)
        : null,
      signalEffectiveDate: signalRow?.signal_effective_date
        ? toIsoDate(signalRow.signal_effective_date)
        : null,
      signalKey: signalRow?.signal_key ?? null,
      signalLabel: signalRow?.signal_label ?? null,
      signalValue: toNullableNumber(signalRow?.signal_value),
      signalConfidence: toNullableNumber(signalRow?.signal_confidence),
      primaryMetricKey: signalRow?.primary_metric_key ?? null,
      primaryFeatureKey: signalRow?.primary_feature_key ?? null,
      primaryFeatureValue: toNullableNumber(signalRow?.primary_feature_value),
      observedMetricCount: toNullableNumber(signalRow?.observed_metric_count),
      totalMetricCount: toNullableNumber(signalRow?.total_metric_count),
      featureValues: parseFeatureValues(signalRow?.feature_values),
      candidateCount: candidates.length,
      selectedPriority:
        candidates.find((candidate) => candidate.signalKey === signalRow?.signal_key)
          ?.priority ?? null,
      candidates,
      supportingEvidence: parseSignalEvidence(signalRow?.supporting_evidence),
      contradictingEvidence: parseSignalEvidence(signalRow?.contradicting_evidence),
    },
  };
}

function summarizeSelectionRules(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "-";

  const rules = value as {
    default?: unknown;
    all?: unknown;
    any?: unknown;
  };
  if (rules.default === true) return "Default fallback";

  const parts = [
    ...summarizeRuleConditions("All", rules.all),
    ...summarizeRuleConditions("Any", rules.any),
  ];
  return parts.length > 0 ? parts.join(" | ") : "-";
}

function summarizeRuleConditions(label: string, value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((condition) => {
    if (!condition || typeof condition !== "object" || Array.isArray(condition)) {
      return [];
    }

    const raw = condition as Record<string, unknown>;
    const featureKey =
      typeof raw.featureKey === "string" ? formatFeatureLabel(raw.featureKey) : null;
    const operator = typeof raw.operator === "string" ? raw.operator : null;
    const conditionValue = toNullableNumber(raw.value);
    const minObservedMetricCount = toNullableNumber(raw.minObservedMetricCount);

    if (!featureKey || !operator || conditionValue === null) return [];

    return [
      `${label}: ${featureKey} ${operator} ${formatRuleNumber(conditionValue)}${
        minObservedMetricCount !== null
          ? `, min metrics ${minObservedMetricCount}`
          : ""
      }`,
    ];
  });
}

function formatRuleNumber(value: number): string {
  if (Math.abs(value) <= 5) return `${(value * 100).toFixed(1)}%`;
  return value.toFixed(2);
}

function formatFeatureLabel(featureKey: string): string {
  return featureKey
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function toIsoDate(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
}

function toNullableNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseFeatureValues(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entry]) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];

      const raw = entry as Record<string, unknown>;
      const featureValue = toNullableNumber(raw.value);
      const observedMetricCount = toNullableNumber(raw.observedMetricCount);

      if (featureValue === null || observedMetricCount === null) return [];

      return [[key, { value: featureValue, observedMetricCount }]];
    }),
  );
}

function parseSignalEvidence(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];

    const raw = item as Record<string, unknown>;
    const featureValue = toNullableNumber(raw.featureValue);
    if (
      typeof raw.metricKey !== "string" ||
      typeof raw.featureKey !== "string" ||
      typeof raw.periodEnd !== "string" ||
      typeof raw.effectiveDate !== "string" ||
      featureValue === null
    ) {
      return [];
    }

    return [
      {
        metricKey: raw.metricKey,
        featureKey: raw.featureKey,
        featureValue,
        periodEnd: raw.periodEnd,
        effectiveDate: raw.effectiveDate,
      },
    ];
  });
}
