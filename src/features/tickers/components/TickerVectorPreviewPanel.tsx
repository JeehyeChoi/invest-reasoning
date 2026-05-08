import { useState } from "react";

import type {
  TickerOverviewFactorMetric,
  TickerOverviewFactorSignal,
  TickerSignalDetail,
} from "@/shared/tickers/tickerOverview";
import { Panel, Td, Th } from "@/features/tickers/components/TickerDetailPrimitives";
import {
  formatCompactValue,
  formatFeatureValue,
  formatLabel,
} from "@/features/tickers/utils/formatters";
import { fetchTickerSignalDetail } from "@/features/tickers/services/fetchTickerSignalDetail";

type Props = {
  ticker: string;
  factorSignals: TickerOverviewFactorSignal[];
  factorMetrics: TickerOverviewFactorMetric[];
};

export function TickerVectorPreviewPanel({
  ticker,
  factorSignals,
  factorMetrics,
}: Props) {
  const rows = buildFactorSignalRows({ factorSignals, factorMetrics });
  const [openDetailId, setOpenDetailId] = useState<string | null>(null);
  const [detailsById, setDetailsById] = useState<Record<string, TickerSignalDetail>>(
    {},
  );
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  async function toggleDetail(row: ReturnType<typeof buildFactorSignalRows>[number]) {
    if (openDetailId === row.id) {
      setOpenDetailId(null);
      return;
    }

    setOpenDetailId(row.id);
    setDetailError(null);

    if (detailsById[row.id]) return;

    try {
      setLoadingDetailId(row.id);
      const detail = await fetchTickerSignalDetail({
        ticker,
        factor: row.rawFactor,
        axis: row.rawAxis,
      });
      setDetailsById((current) => ({ ...current, [row.id]: detail }));
    } catch (error) {
      setDetailError(
        error instanceof Error ? error.message : "Failed to load signal detail",
      );
    } finally {
      setLoadingDetailId(null);
    }
  }

  return (
    <Panel title="Vector Preview">
      {rows.length > 0 ? (
        <div className="grid gap-3">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[#c0c0c0]">
                  <Th>Factor</Th>
                  <Th>Axis</Th>
                  <Th>Selected Signal</Th>
                  <Th>Evidence</Th>
                  <Th>Driver</Th>
                  <Th>Detail</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const isOpen = openDetailId === row.id;

                  return (
                    <tr key={row.id} className={isOpen ? "bg-[#ffffcc]" : "bg-white"}>
                      <Td>{row.factor}</Td>
                      <Td>{row.axis}</Td>
                      <Td>
                        <span className="font-bold">{row.signal}</span>
                      </Td>
                      <Td>{row.evidence}</Td>
                      <Td>{row.driver}</Td>
                      <Td>
                        <button
                          type="button"
                          className="border border-black bg-[#c0c0c0] px-2 py-1 text-xs font-bold"
                          onClick={() => {
                            void toggleDetail(row);
                          }}
                        >
                          {isOpen ? "Hide" : "Detail"}
                        </button>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {openDetailId ? (
            <SignalDetailPanel
              row={rows.find((row) => row.id === openDetailId) ?? null}
              detail={detailsById[openDetailId] ?? null}
              isLoading={loadingDetailId === openDetailId}
              error={detailError}
              factorMetrics={factorMetrics}
            />
          ) : null}
        </div>
      ) : (
        <p className="font-mono text-sm">No factor signals found.</p>
      )}
    </Panel>
  );
}

function buildFactorSignalRows(input: {
  factorSignals: TickerOverviewFactorSignal[];
  factorMetrics: TickerOverviewFactorMetric[];
}) {
  if (input.factorSignals.length > 0) {
    return input.factorSignals.map((factorSignal) => {
      const relatedMetric = findRelatedMetric({
        factorSignal,
        factorMetrics: input.factorMetrics,
      });
      const candidates = factorSignal.candidates;
      const selectedCandidate = candidates.find(
        (candidate) => candidate.signalKey === factorSignal.signalKey,
      );

      return buildFactorSignalDisplayRow({
        id: `${factorSignal.factor}:${factorSignal.axis}`,
        factor: factorSignal.factor,
        axis: factorSignal.axis,
        insight: factorSignal,
        candidates,
        selectedCandidate,
        featureRows: buildVectorFeatureRowsFromSignal(factorSignal, relatedMetric),
        evidenceRows: buildEvidenceRowsFromSignal(factorSignal),
      });
    });
  }

  const rowsByScope = new Map<string, TickerOverviewFactorMetric>();

  for (const metric of input.factorMetrics) {
    const key = `${metric.factor}:${metric.axis}`;
    const current = rowsByScope.get(key);

    if (!current || isBetterFactorScopeMetric(metric, current)) {
      rowsByScope.set(key, metric);
    }
  }

  return Array.from(rowsByScope.values())
    .sort((a, b) => a.factor.localeCompare(b.factor))
    .map((metric) => {
      const insight = metric.factorInsight;
      const candidates = insight?.candidates ?? [];
      const selectedCandidate = candidates.find(
        (candidate) => candidate.signalKey === insight?.signalKey,
      );

      return buildFactorSignalDisplayRow({
        id: `${metric.factor}:${metric.axis}`,
        factor: metric.factor,
        axis: metric.axis,
        insight,
        candidates,
        featureRows: buildVectorFeatureRows(metric),
        evidenceRows: buildEvidenceRows(metric),
        selectedCandidate,
      });
    });
}

function buildFactorSignalDisplayRow(input: {
  id: string;
  factor: string;
  axis: string;
  insight: TickerOverviewFactorMetric["factorInsight"] | TickerOverviewFactorSignal;
  candidates: TickerOverviewFactorSignal["candidates"];
  selectedCandidate: TickerOverviewFactorSignal["candidates"][number] | undefined;
  featureRows: ReturnType<typeof buildVectorFeatureRows>;
  evidenceRows: ReturnType<typeof buildEvidenceRows>;
}) {
  const { insight } = input;

  return {
    id: input.id,
    rawFactor: input.factor as TickerOverviewFactorSignal["factor"],
    rawAxis: input.axis as TickerOverviewFactorSignal["axis"],
    factor: formatLabel(input.factor),
    axis: formatLabel(input.axis),
    signalKey: insight?.signalKey ?? "",
    signal:
      insight?.signalLabel ??
      input.selectedCandidate?.signalLabel ??
      (insight?.signalKey ? formatLabel(insight.signalKey) : "No signal selected"),
    evidence: formatSummaryEvidence(insight),
    driver: formatSignalDriver(insight),
    candidates: input.candidates,
    featureRows: input.featureRows,
    evidenceRows: input.evidenceRows,
  };
}

function SignalDetailPanel({
  row,
  detail,
  isLoading,
  error,
  factorMetrics,
}: {
  row: ReturnType<typeof buildFactorSignalRows>[number] | null;
  detail: TickerSignalDetail | null;
  isLoading: boolean;
  error: string | null;
  factorMetrics: TickerOverviewFactorMetric[];
}) {
  if (!row) return null;

  const relatedMetric = detail?.signal
    ? findRelatedMetric({ factorSignal: detail.signal, factorMetrics })
    : null;
  const detailRow = detail?.signal
    ? buildFactorSignalDisplayRow({
        id: row.id,
        factor: detail.signal.factor,
        axis: detail.signal.axis,
        insight: detail.signal,
        candidates: detail.signal.candidates,
        selectedCandidate: detail.signal.candidates.find(
          (candidate) => candidate.signalKey === detail.signal?.signalKey,
        ),
        featureRows: buildVectorFeatureRowsFromSignal(detail.signal, relatedMetric),
        evidenceRows: buildEvidenceRowsFromSignal(detail.signal),
      })
    : null;

  return (
    <div className="border border-black bg-white">
      <div className="border-b border-black bg-[#c0c0c0] px-2 py-1 text-xs font-bold uppercase">
        {row.factor} / {row.axis} Signal Detail
      </div>
      {isLoading ? (
        <p className="p-2 font-mono text-sm">Loading signal detail...</p>
      ) : error ? (
        <p className="p-2 font-mono text-sm text-red-700">{error}</p>
      ) : detailRow ? (
        <SignalDetailTables row={detailRow} />
      ) : (
        <p className="p-2 font-mono text-sm">No signal detail found.</p>
      )}
    </div>
  );
}

function SignalDetailTables({
  row,
}: {
  row: ReturnType<typeof buildFactorSignalDisplayRow>;
}) {
  return (
    <div className="grid gap-3 p-2">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#c0c0c0]">
              <Th>Candidate</Th>
              <Th>Priority</Th>
              <Th>Selection Rules</Th>
              <Th>Description</Th>
            </tr>
          </thead>
          <tbody>
            {row.candidates.length > 0 ? (
              row.candidates.map((candidate) => {
                const selected = candidate.signalKey === row.signalKey;

                return (
                  <tr
                    key={candidate.signalKey}
                    className={selected ? "bg-[#ffffcc]" : "bg-white"}
                  >
                    <Td>
                      {selected ? "* " : ""}
                      {candidate.signalLabel}
                    </Td>
                    <Td>{candidate.priority ?? "-"}</Td>
                    <Td>{candidate.selectionRulesSummary}</Td>
                    <Td>{candidate.signalDescription ?? "-"}</Td>
                  </tr>
                );
              })
            ) : (
              <tr className="bg-white">
                <Td colSpan={4}>No signal candidates configured.</Td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#c0c0c0]">
              <Th>Feature Vector</Th>
              <Th>Value</Th>
              <Th>Observed Metrics</Th>
            </tr>
          </thead>
          <tbody>
            {row.featureRows.length > 0 ? (
              row.featureRows.map((feature) => (
                <tr key={feature.key} className="bg-white">
                  <Td>{feature.label}</Td>
                  <Td>{feature.value}</Td>
                  <Td>{feature.observedMetricCount}</Td>
                </tr>
              ))
            ) : (
              <tr className="bg-white">
                <Td colSpan={3}>No feature vector values found.</Td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#c0c0c0]">
              <Th>Evidence</Th>
              <Th>Metric</Th>
              <Th>Feature</Th>
              <Th>Value</Th>
              <Th>Period</Th>
            </tr>
          </thead>
          <tbody>
            {row.evidenceRows.length > 0 ? (
              row.evidenceRows.map((evidence) => (
                <tr key={evidence.key} className="bg-white">
                  <Td>{evidence.kind}</Td>
                  <Td>{evidence.metric}</Td>
                  <Td>{evidence.feature}</Td>
                  <Td>{evidence.value}</Td>
                  <Td>{evidence.period}</Td>
                </tr>
              ))
            ) : (
              <tr className="bg-white">
                <Td colSpan={5}>No signal evidence found.</Td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatSignalDriver(
  insight:
    | TickerOverviewFactorMetric["factorInsight"]
    | TickerOverviewFactorSignal
    | null
    | undefined,
): string {
  if (!insight?.primaryFeatureKey || insight.primaryFeatureValue === null) {
    return "-";
  }

  return `${formatLabel(insight.primaryFeatureKey)} = ${formatVectorFeatureValue(
    insight.primaryFeatureKey,
    insight.primaryFeatureValue,
  )}`;
}

function formatSummaryEvidence(
  insight:
    | TickerOverviewFactorMetric["factorInsight"]
    | TickerOverviewFactorSignal
    | null
    | undefined,
): string {
  if (!insight?.signalKey) return "-";

  const parts = [
    insight.candidateCount > 0 ? `${insight.candidateCount} candidates` : null,
    insight.selectedPriority !== null
      ? `selected priority ${insight.selectedPriority}`
      : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : "-";
}

function formatSelectionEvidence(input: {
  insight:
    | TickerOverviewFactorMetric["factorInsight"]
    | TickerOverviewFactorSignal
    | null
    | undefined;
  selectedCandidate:
    | TickerOverviewFactorSignal["candidates"][number]
    | undefined;
}): string {
  if (!input.insight?.signalKey) return "-";

  const rules = normalizeSelectionRules(input.selectedCandidate?.selectionRules);

  if (rules.default) return "Default";

  const parts = [
    formatRuleEvidencePart("All", rules.all, input.insight.featureValues),
    formatRuleEvidencePart("Any", rules.any, input.insight.featureValues),
  ].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(", ") : "-";
}

function formatRuleEvidencePart(
  label: string,
  conditions: SignalSelectionCondition[],
  featureValues: NonNullable<
    TickerOverviewFactorMetric["factorInsight"]
  >["featureValues"],
): string | null {
  if (conditions.length === 0) return null;

  const matchedCount = conditions.filter((condition) =>
    matchesSignalCondition(condition, featureValues),
  ).length;

  return `${label} ${matchedCount}/${conditions.length}`;
}

type NormalizedSelectionRules = {
  default: boolean;
  all: SignalSelectionCondition[];
  any: SignalSelectionCondition[];
};

type SignalSelectionCondition = {
  featureKey: string;
  operator: ">=" | ">" | "<=" | "<" | "=";
  value: number;
  minObservedMetricCount: number;
};

function normalizeSelectionRules(value: unknown): NormalizedSelectionRules {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { default: false, all: [], any: [] };
  }

  const raw = value as Record<string, unknown>;

  return {
    default: raw.default === true,
    all: normalizeSelectionConditions(raw.all),
    any: normalizeSelectionConditions(raw.any),
  };
}

function normalizeSelectionConditions(value: unknown): SignalSelectionCondition[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];

    const raw = item as Record<string, unknown>;
    const featureKey = typeof raw.featureKey === "string" ? raw.featureKey : null;
    const operator = isSelectionOperator(raw.operator) ? raw.operator : null;
    const threshold = Number(raw.value);
    const minObservedMetricCount = Number(raw.minObservedMetricCount ?? 1);

    if (!featureKey || !operator || !Number.isFinite(threshold)) return [];

    return [
      {
        featureKey,
        operator,
        value: threshold,
        minObservedMetricCount: Number.isFinite(minObservedMetricCount)
          ? minObservedMetricCount
          : 1,
      },
    ];
  });
}

function isSelectionOperator(
  value: unknown,
): value is SignalSelectionCondition["operator"] {
  return (
    value === ">=" ||
    value === ">" ||
    value === "<=" ||
    value === "<" ||
    value === "="
  );
}

function matchesSignalCondition(
  condition: SignalSelectionCondition,
  featureValues: NonNullable<
    TickerOverviewFactorMetric["factorInsight"]
  >["featureValues"],
): boolean {
  const featureValue = featureValues[condition.featureKey];

  if (!featureValue) return false;
  if (featureValue.observedMetricCount < condition.minObservedMetricCount) {
    return false;
  }

  if (condition.operator === ">=") return featureValue.value >= condition.value;
  if (condition.operator === ">") return featureValue.value > condition.value;
  if (condition.operator === "<=") return featureValue.value <= condition.value;
  if (condition.operator === "<") return featureValue.value < condition.value;

  return featureValue.value === condition.value;
}

function findRelatedMetric(input: {
  factorSignal: TickerOverviewFactorSignal;
  factorMetrics: TickerOverviewFactorMetric[];
}): TickerOverviewFactorMetric | null {
  return (
    input.factorMetrics.find(
      (metric) =>
        metric.factor === input.factorSignal.factor &&
        metric.axis === input.factorSignal.axis &&
        metric.metricKey === input.factorSignal.primaryMetricKey,
    ) ??
    input.factorMetrics.find(
      (metric) =>
        metric.factor === input.factorSignal.factor &&
        metric.axis === input.factorSignal.axis,
    ) ??
    null
  );
}

function isBetterFactorScopeMetric(
  candidate: TickerOverviewFactorMetric,
  current: TickerOverviewFactorMetric,
): boolean {
  const candidateHasSignal = Boolean(candidate.factorInsight?.signalKey);
  const currentHasSignal = Boolean(current.factorInsight?.signalKey);

  if (candidateHasSignal !== currentHasSignal) {
    return candidateHasSignal;
  }

  const candidateConfidence =
    candidate.factorInsight?.signalConfidence ?? Number.NEGATIVE_INFINITY;
  const currentConfidence =
    current.factorInsight?.signalConfidence ?? Number.NEGATIVE_INFINITY;

  if (candidateConfidence !== currentConfidence) {
    return candidateConfidence > currentConfidence;
  }

  const candidateCandidateCount = candidate.factorInsight?.candidates.length ?? 0;
  const currentCandidateCount = current.factorInsight?.candidates.length ?? 0;

  if (candidateCandidateCount !== currentCandidateCount) {
    return candidateCandidateCount > currentCandidateCount;
  }

  const candidateFeatureCount = candidate.features?.length ?? 0;
  const currentFeatureCount = current.features?.length ?? 0;

  if (candidateFeatureCount !== currentFeatureCount) {
    return candidateFeatureCount > currentFeatureCount;
  }

  return (candidate.effectiveDate ?? "") > (current.effectiveDate ?? "");
}

function buildVectorFeatureRows(metric: TickerOverviewFactorMetric) {
  const featureValues = metric.factorInsight?.featureValues ?? {};
  const featureLabels = metric.display?.metricLabels ?? {};
  const featureOrder = metric.display?.metricOrder ?? [];
  const featureValueRows = Object.entries(featureValues).map(
    ([featureKey, entry]) => ({
      key: featureKey,
      label: featureLabels[featureKey] ?? formatLabel(featureKey),
      value: formatVectorFeatureValue(featureKey, entry.value),
      observedMetricCount: String(entry.observedMetricCount),
    }),
  );
  const metricFeatureRows = (metric.features ?? []).map((feature) => ({
    key: feature.featureKey,
    label: feature.featureLabel,
    value:
      feature.featureValue === null
        ? "-"
        : formatVectorFeatureValue(feature.featureKey, feature.featureValue),
    observedMetricCount: "-",
  }));
  const rows = featureValueRows.length > 0 ? featureValueRows : metricFeatureRows;

  return rows
    .sort((a, b) => {
      const aIndex = featureOrder.indexOf(a.key);
      const bIndex = featureOrder.indexOf(b.key);

      if (aIndex !== -1 || bIndex !== -1) {
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      }

      return a.label.localeCompare(b.label);
    });
}

function buildVectorFeatureRowsFromSignal(
  factorSignal: TickerOverviewFactorSignal,
  relatedMetric: TickerOverviewFactorMetric | null,
) {
  const featureValues = factorSignal.featureValues;
  const featureLabels = relatedMetric?.display?.metricLabels ?? {};
  const featureOrder = relatedMetric?.display?.metricOrder ?? [];

  return Object.entries(featureValues)
    .map(([featureKey, entry]) => ({
      key: featureKey,
      label: featureLabels[featureKey] ?? formatLabel(featureKey),
      value: formatVectorFeatureValue(featureKey, entry.value),
      observedMetricCount: String(entry.observedMetricCount),
    }))
    .sort((a, b) => {
      const aIndex = featureOrder.indexOf(a.key);
      const bIndex = featureOrder.indexOf(b.key);

      if (aIndex !== -1 || bIndex !== -1) {
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      }

      return a.label.localeCompare(b.label);
    });
}

function formatVectorFeatureValue(featureKey: string, value: number) {
  if (featureKey.toLowerCase().endsWith("value")) {
    return formatCompactValue(value);
  }

  return formatFeatureValue(value);
}

function buildEvidenceRows(metric: TickerOverviewFactorMetric) {
  const insight = metric.factorInsight;
  const supportingEvidence = insight?.supportingEvidence ?? [];
  const contradictingEvidence = insight?.contradictingEvidence ?? [];

  return [
    ...supportingEvidence.map((evidence, index) => ({
      key: `supporting-${index}-${evidence.metricKey}-${evidence.featureKey}`,
      kind: "Supporting",
      metric: formatLabel(evidence.metricKey),
      feature: formatLabel(evidence.featureKey),
      value: formatFeatureValue(evidence.featureValue),
      period: evidence.periodEnd,
    })),
    ...contradictingEvidence.map((evidence, index) => ({
      key: `contradicting-${index}-${evidence.metricKey}-${evidence.featureKey}`,
      kind: "Contradicting",
      metric: formatLabel(evidence.metricKey),
      feature: formatLabel(evidence.featureKey),
      value: formatFeatureValue(evidence.featureValue),
      period: evidence.periodEnd,
    })),
  ];
}

function buildEvidenceRowsFromSignal(factorSignal: TickerOverviewFactorSignal) {
  return [
    ...factorSignal.supportingEvidence.map((evidence, index) => ({
      key: `supporting-${index}-${evidence.metricKey}-${evidence.featureKey}`,
      kind: "Supporting",
      metric: formatLabel(evidence.metricKey),
      feature: formatLabel(evidence.featureKey),
      value: formatFeatureValue(evidence.featureValue),
      period: evidence.periodEnd,
    })),
    ...factorSignal.contradictingEvidence.map((evidence, index) => ({
      key: `contradicting-${index}-${evidence.metricKey}-${evidence.featureKey}`,
      kind: "Contradicting",
      metric: formatLabel(evidence.metricKey),
      feature: formatLabel(evidence.featureKey),
      value: formatFeatureValue(evidence.featureValue),
      period: evidence.periodEnd,
    })),
  ];
}
