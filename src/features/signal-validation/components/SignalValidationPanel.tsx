"use client";

import { Clipboard, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FACTOR_AXIS_KEYS, type FactorAxisKey } from "@/shared/factors/axes";
import { FACTOR_KEYS, type FactorKey } from "@/shared/factors/factors";
import {
  DEFAULT_UNIVERSE_KEYS,
  UNIVERSE_LABELS,
  UNIVERSE_KEYS,
  type UniverseKey,
} from "@/shared/universe/universes";
import type { SignalClusteringQuestionPolicy } from "@/shared/market/signalClusteringPolicy";
import {
  buildSignalClusteringQuestionPolicyMap,
  getSignalClusteringQuestionPolicyFromMap,
} from "@/features/signal-validation/utils/signalClusteringQuestionPolicyMap";
import {
  fetchFactorSignalValidation,
  refreshSignalClusteringPolicies,
  type FactorSignalValidationReport,
  type FactorSignalValidationRow,
} from "@/features/signal-validation/services/fetchFactorSignalValidation";

type ClusteringRecommendationAction = "include" | "review" | "exclude";

type SignalValidationRecommendation = {
  row: FactorSignalValidationRow;
  action: ClusteringRecommendationAction;
  score: number;
  reasons: string[];
};

type QuestionRecommendationAction = "use" | "review" | "hold";

type FactorAxisQuestionSummary = {
  factor: FactorKey;
  axis: FactorAxisKey;
  action: QuestionRecommendationAction;
  selectedCount: number;
  noSignalCount: number;
  mixedCount: number;
  directionalCount: number;
  stateCount: number;
  noSignalShare: number;
  mixedShare: number;
  directionalShare: number;
  dominantSignal: FactorSignalValidationRow | null;
  dominantShare: number;
  entropy: number | null;
  manualPolicy: SignalClusteringQuestionPolicy | null;
  reasons: string[];
};

const AXIS_LABELS: Record<FactorAxisKey, string> = {
  fundamentals_based: "Fundamentals",
  market_price: "Market price",
  valuation: "Valuation",
  macro_linked: "Macro linked",
  etf_exposure: "ETF exposure",
  narrative_implied: "Narrative implied",
};

function formatKeyLabel(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatCount(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return value.toLocaleString();
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  const magnitude = Math.abs(value);

  if (magnitude >= 100) return value.toFixed(0);
  if (magnitude >= 10) return value.toFixed(1);
  return value.toFixed(3);
}

function formatCoverage(row: FactorSignalValidationRow) {
  const all =
    row.avgAllTotal && row.avgAllTotal > 0
      ? `all ${formatNumber(row.avgAllMatched)}/${formatNumber(row.avgAllTotal)}`
      : null;
  const any =
    row.avgAnyTotal && row.avgAnyTotal > 0
      ? `any ${formatNumber(row.avgAnyMatched)}/${formatNumber(row.avgAnyTotal)}`
      : null;

  return [all, any].filter(Boolean).join(" | ") || "-";
}

function formatExamples(values: string[]) {
  return values.length > 0 ? values.join(", ") : "-";
}

function getRowSortScore(row: FactorSignalValidationRow) {
  const noSignalWeight = row.noSignalShare ?? 0;
  const shadowWeight = row.shadowedCandidateCount > 0 ? 0.5 : 0;
  const mixedWeight =
    row.signalKey.includes("mixed") || row.mixedShare === 1 ? row.share ?? 0 : 0;

  return noSignalWeight + shadowWeight + mixedWeight;
}

function buildClusteringRecommendation(
  row: FactorSignalValidationRow,
): SignalValidationRecommendation {
  const share = row.share ?? 0;
  const shadowRate =
    row.count > 0 ? row.shadowedCandidateCount / Math.max(row.count, 1) : 0;
  const minMetrics = row.minMetricsMetShare ?? 0;
  const isMixed = row.signalKey.includes("mixed") || row.mixedShare === 1;
  const reasons: string[] = [];
  let score = 0;

  if (row.count === 0) {
    reasons.push("no tickers currently match this signal");
    score += 6;
  }

  if (isMixed) {
    reasons.push("mixed/default signal should not define cluster identity");
    score += 5;
  }

  if (share > 0 && share < 0.015) {
    reasons.push(`too sparse for stable clustering (${formatPercent(share)})`);
    score += 3;
  }

  if (share > 0.55) {
    reasons.push(`too broad for cluster separation (${formatPercent(share)})`);
    score += 3;
  }

  if (minMetrics > 0 && minMetrics < 0.8) {
    reasons.push(`weak metric coverage (${formatPercent(minMetrics)})`);
    score += 3;
  }

  if (shadowRate >= 0.8) {
    reasons.push(`heavily shadowed by lower-priority candidates (${formatPercent(shadowRate)})`);
    score += 3;
  } else if (shadowRate >= 0.35) {
    reasons.push(`meaningful rule overlap (${formatPercent(shadowRate)})`);
    score += 1;
  }

  if ((row.topSectorShare ?? 0) >= 0.65) {
    reasons.push(`mostly a sector proxy (${formatPercent(row.topSectorShare)})`);
    score += 2;
  }

  if (reasons.length === 0) {
    reasons.push("balanced enough to include as a clustering feature candidate");
  }

  const action: ClusteringRecommendationAction =
    row.count === 0 || isMixed || minMetrics < 0.65 || share < 0.005
      ? "exclude"
      : score >= 3
        ? "review"
        : "include";

  return {
    row,
    action,
    score,
    reasons,
  };
}

function getActionLabel(action: ClusteringRecommendationAction) {
  if (action === "include") return "Include";
  if (action === "exclude") return "Exclude";
  return "Review";
}

function getActionClassName(action: ClusteringRecommendationAction) {
  if (action === "include") return "border-emerald-700 bg-emerald-50 text-emerald-800";
  if (action === "exclude") return "border-red-700 bg-red-50 text-red-800";
  return "border-amber-700 bg-amber-50 text-amber-800";
}

function getQuestionActionLabel(action: QuestionRecommendationAction) {
  if (action === "use") return "Use as clustering question";
  if (action === "hold") return "Hold out for now";
  return "Review question";
}

function getQuestionActionClassName(action: QuestionRecommendationAction) {
  if (action === "use") return "border-emerald-700 bg-emerald-50 text-emerald-800";
  if (action === "hold") return "border-red-700 bg-red-50 text-red-800";
  return "border-amber-700 bg-amber-50 text-amber-800";
}

function isMixedSignal(row: FactorSignalValidationRow) {
  return row.signalKey.includes("mixed") || row.mixedShare === 1;
}

function buildQuestionSummaries(
  report: FactorSignalValidationReport | null,
): FactorAxisQuestionSummary[] {
  if (!report) return [];

  const rowsByQuestion = new Map<string, FactorSignalValidationRow[]>();
  const policiesByQuestion = buildSignalClusteringQuestionPolicyMap(
    report.questionPolicies,
  );

  for (const row of report.rows) {
    const key = `${row.factor}:${row.axis}`;
    rowsByQuestion.set(key, [...(rowsByQuestion.get(key) ?? []), row]);
  }

  return [...rowsByQuestion.values()]
    .map((rows) =>
      buildQuestionSummary({
        rows,
        universeTickerCount: report.totals.universeTickerCount,
        manualPolicy:
          rows[0]
            ? getSignalClusteringQuestionPolicyFromMap({
                policiesByQuestion,
                factor: rows[0].factor,
                axis: rows[0].axis,
              })
            : null,
      }),
    )
    .sort((a, b) => {
      const order: Record<QuestionRecommendationAction, number> = {
        review: 1,
        hold: 2,
        use: 3,
      };

      return (
        order[a.action] - order[b.action] ||
        b.noSignalShare - a.noSignalShare ||
        b.dominantShare - a.dominantShare ||
        `${a.factor}:${a.axis}`.localeCompare(`${b.factor}:${b.axis}`)
      );
    });
}

function buildQuestionSummary(input: {
  rows: FactorSignalValidationRow[];
  universeTickerCount: number;
  manualPolicy: SignalClusteringQuestionPolicy | null;
}): FactorAxisQuestionSummary {
  const { rows, universeTickerCount, manualPolicy } = input;
  const firstRow = rows[0];
  const selectedCount = rows.reduce((sum, row) => sum + row.count, 0);
  const mixedCount = rows
    .filter(isMixedSignal)
    .reduce((sum, row) => sum + row.count, 0);
  const directionalCount = selectedCount - mixedCount;
  const noSignalCount = Math.max(0, universeTickerCount - selectedCount);
  const denominator = Math.max(universeTickerCount, 1);
  const noSignalShare = noSignalCount / denominator;
  const mixedShare = mixedCount / denominator;
  const directionalShare = directionalCount / denominator;
  const dominantSignal =
    rows
      .filter((row) => row.count > 0)
      .sort((a, b) => b.count - a.count)[0] ?? null;
  const dominantShare = dominantSignal ? dominantSignal.count / denominator : 0;
  const stateCounts = [
    ...rows.filter((row) => row.count > 0).map((row) => row.count),
    ...(noSignalCount > 0 ? [noSignalCount] : []),
  ];
  const entropy = calcNormalizedEntropy(stateCounts);
  const reasons: string[] = [];

  if (noSignalShare > 0.35) {
    reasons.push(
      `many tickers have no selected answer (${formatPercent(noSignalShare)})`,
    );
  } else if (noSignalShare > 0.2) {
    reasons.push(`coverage/readiness gap (${formatPercent(noSignalShare)} no signal)`);
  }

  if (dominantShare > 0.6) {
    reasons.push(
      `one answer dominates the question (${dominantSignal?.signalLabel ?? "-"} ${formatPercent(
        dominantShare,
      )})`,
    );
  }

  if (directionalShare < 0.25) {
    reasons.push(
      `few directional answers for active Jaccard signals (${formatPercent(
        directionalShare,
      )})`,
    );
  }

  if (entropy !== null && entropy < 0.45) {
    reasons.push(`low answer diversity (${formatNumber(entropy)} normalized entropy)`);
  }

  if (reasons.length === 0) {
    reasons.push(
      "question has usable coverage and answer diversity; mixed remains context for state-vector distance",
    );
  }

  const action: QuestionRecommendationAction =
    manualPolicy?.status === "hold"
      ? "hold"
      : manualPolicy?.status === "review"
        ? "review"
        : noSignalShare > 0.45 || directionalShare < 0.1
          ? "hold"
          : reasons.length > 1 || noSignalShare > 0.2 || dominantShare > 0.6
            ? "review"
            : "use";

  if (manualPolicy) {
    reasons.unshift(`manual policy: ${manualPolicy.reason}`);
  }

  return {
    factor: firstRow?.factor ?? "growth",
    axis: firstRow?.axis ?? "fundamentals_based",
    action,
    selectedCount,
    noSignalCount,
    mixedCount,
    directionalCount,
    stateCount: stateCounts.length,
    noSignalShare,
    mixedShare,
    directionalShare,
    dominantSignal,
    dominantShare,
    entropy,
    manualPolicy,
    reasons,
  };
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

function buildRecommendationMarkdown(input: {
  report: FactorSignalValidationReport | null;
  questionSummaries: FactorAxisQuestionSummary[];
  recommendations: SignalValidationRecommendation[];
  counts: Record<ClusteringRecommendationAction, number>;
}) {
  const lines = [
    "# Signal Validation Summary",
    "",
    `Generated: ${input.report?.generatedAt ?? new Date().toISOString()}`,
    `Universe: ${(input.report?.universeKeys ?? DEFAULT_UNIVERSE_KEYS)
      .map((key) => UNIVERSE_LABELS[key])
      .join(", ")}`,
    "",
    "## Question Recommendations",
    "",
    ...input.questionSummaries.map((summary) => {
      return [
        `### ${getQuestionActionLabel(summary.action)}: ${formatKeyLabel(
          summary.factor,
        )} / ${AXIS_LABELS[summary.axis]}`,
        "",
        `- Selected / no signal: ${formatCount(summary.selectedCount)} / ${formatCount(
          summary.noSignalCount,
        )} (${formatPercent(summary.noSignalShare)} no signal)`,
        `- Directional / mixed: ${formatCount(summary.directionalCount)} / ${formatCount(
          summary.mixedCount,
        )}`,
        `- Dominant answer: ${
          summary.dominantSignal?.signalLabel ?? "-"
        } (${formatPercent(summary.dominantShare)})`,
        `- Answer diversity: ${
          summary.entropy === null ? "-" : formatNumber(summary.entropy)
        }`,
        `- Manual policy: ${summary.manualPolicy?.status ?? "none"}`,
        `- Rationale: ${summary.reasons.join("; ")}.`,
        "",
      ].join("\n");
    }),
    "",
    "## Signal Diagnostic Counts",
    "",
    `- Include: ${input.counts.include}`,
    `- Review: ${input.counts.review}`,
    `- Exclude: ${input.counts.exclude}`,
    "",
    "## Top Recommendations",
    "",
  ];

  for (const recommendation of input.recommendations.slice(0, 30)) {
    const row = recommendation.row;
    const shadowRate =
      row.count > 0 ? row.shadowedCandidateCount / row.count : null;

    lines.push(
      `### ${getActionLabel(recommendation.action)}: ${formatKeyLabel(
        row.factor,
      )} / ${AXIS_LABELS[row.axis]} / ${row.signalLabel}`,
      "",
      `- Signal key: \`${row.signalKey}\``,
      `- Count / share: ${formatCount(row.count)} / ${formatPercent(row.share)}`,
      `- Min metrics: ${formatPercent(row.minMetricsMetShare)}`,
      `- Shadowed: ${formatPercent(shadowRate)}`,
      `- Top sector: ${row.topSector ?? "-"} ${
        row.topSectorShare ? `(${formatPercent(row.topSectorShare)})` : ""
      }`.trim(),
      `- Recommendation: ${getActionLabel(recommendation.action)}`,
      `- Rationale: ${recommendation.reasons.join("; ")}.`,
      "",
    );
  }

  return lines.join("\n");
}

export function SignalValidationPanel() {
  const [factor, setFactor] = useState<FactorKey | "all">("all");
  const [axis, setAxis] = useState<FactorAxisKey | "all">("all");
  const [selectedUniverseKeys, setSelectedUniverseKeys] =
    useState<UniverseKey[]>([...DEFAULT_UNIVERSE_KEYS]);
  const [report, setReport] = useState<FactorSignalValidationReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPolicyRefreshing, setIsPolicyRefreshing] = useState(false);
  const [showRawTable, setShowRawTable] = useState(false);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const [policyNotice, setPolicyNotice] = useState<string | null>(null);

  const visibleRows = useMemo(() => {
    return [...(report?.rows ?? [])]
      .filter((row) => row.count > 0)
      .sort((a, b) => {
        const scoreDelta = getRowSortScore(b) - getRowSortScore(a);
        if (scoreDelta !== 0) return scoreDelta;
        if (a.factor !== b.factor) return a.factor.localeCompare(b.factor);
        if (a.axis !== b.axis) return a.axis.localeCompare(b.axis);
        return b.count - a.count;
      });
  }, [report]);

  const recommendations = useMemo(() => {
    return visibleRows
      .map(buildClusteringRecommendation)
      .sort((a, b) => {
        if (a.action !== b.action) {
          const order: Record<ClusteringRecommendationAction, number> = {
            review: 1,
            exclude: 2,
            include: 3,
          };

          return order[a.action] - order[b.action];
        }

        return b.score - a.score || b.row.count - a.row.count;
      });
  }, [visibleRows]);

  const questionSummaries = useMemo(() => {
    return buildQuestionSummaries(report);
  }, [report]);

  const questionCounts = useMemo(() => {
    return questionSummaries.reduce(
      (counts, summary) => ({
        ...counts,
        [summary.action]: counts[summary.action] + 1,
      }),
      { use: 0, review: 0, hold: 0 } satisfies Record<
        QuestionRecommendationAction,
        number
      >,
    );
  }, [questionSummaries]);

  const recommendationCounts = useMemo(() => {
    return recommendations.reduce(
      (counts, recommendation) => ({
        ...counts,
        [recommendation.action]: counts[recommendation.action] + 1,
      }),
      { include: 0, review: 0, exclude: 0 } satisfies Record<
        ClusteringRecommendationAction,
        number
      >,
    );
  }, [recommendations]);

  const loadReport = useCallback(async () => {
    setIsLoading(true);

    try {
      const data = await fetchFactorSignalValidation({
        factor: factor === "all" ? undefined : factor,
        axis: axis === "all" ? undefined : axis,
        universeKeys: selectedUniverseKeys,
      });

      setReport(data);
      setError(null);
    } catch {
      setError("Signal validation report failed to load.");
    } finally {
      setIsLoading(false);
    }
  }, [axis, factor, selectedUniverseKeys]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  function toggleUniverse(universeKey: UniverseKey) {
    setSelectedUniverseKeys((current) => {
      const next = current.includes(universeKey)
        ? current.filter((item) => item !== universeKey)
        : [...current, universeKey];

      return next.length > 0 ? next : current;
    });
  }

  async function copySummaryMarkdown() {
    const markdown = buildRecommendationMarkdown({
      report,
      questionSummaries,
      recommendations,
      counts: recommendationCounts,
    });

    try {
      await navigator.clipboard.writeText(markdown);
      setCopyNotice("Markdown copied.");
    } catch {
      setCopyNotice("Copy failed.");
    }

    window.setTimeout(() => setCopyNotice(null), 2500);
  }

  async function refreshPolicyState() {
    setIsPolicyRefreshing(true);
    setPolicyNotice(null);

    try {
      const result = await refreshSignalClusteringPolicies({
        factor: factor === "all" ? undefined : factor,
        axis: axis === "all" ? undefined : axis,
        universeKeys: selectedUniverseKeys,
      });

      setPolicyNotice(
        `Policy refreshed: ${result.updated} questions (${result.counts.use} use / ${result.counts.review} review / ${result.counts.hold} hold).`,
      );
      await loadReport();
    } catch {
      setPolicyNotice("Policy refresh failed.");
    } finally {
      setIsPolicyRefreshing(false);
      window.setTimeout(() => setPolicyNotice(null), 4000);
    }
  }

  return (
    <main className="w-full max-w-none space-y-4 p-4 lg:p-6">
      <section className="border border-black bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-xl font-bold">Signal Validation</h1>
            <div className="mt-2 grid gap-2 text-sm text-gray-700 sm:grid-cols-2 lg:grid-cols-5">
              <p>
                <span className="font-bold">Factor axes:</span>{" "}
                {formatCount(report?.totals.factorAxisCount)}
              </p>
              <p>
                <span className="font-bold">Signals:</span>{" "}
                {formatCount(report?.totals.selectedSignalCount)}
              </p>
              <p>
                <span className="font-bold">Universe:</span>{" "}
                {formatCount(report?.totals.universeTickerCount)}
              </p>
              <p>
                <span className="font-bold">Mixed:</span>{" "}
                {formatCount(report?.totals.mixedCount)}
              </p>
              <p>
                <span className="font-bold">No signal:</span>{" "}
                {formatCount(report?.totals.noSignalCount)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void loadReport()}
            disabled={isLoading}
            className="inline-flex h-9 items-center justify-center gap-2 border border-black bg-[#173b35] px-3 text-sm font-bold text-white disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </section>

      <section className="grid gap-3 border border-black bg-[#f5f5f5] p-4 xl:grid-cols-[minmax(180px,0.35fr)_minmax(180px,0.35fr)_1fr]">
        <label className="text-sm">
          <span className="mb-1 block font-bold">Factor</span>
          <select
            value={factor}
            onChange={(event) => setFactor(event.target.value as FactorKey | "all")}
            className="h-9 w-full border border-black bg-white px-2"
          >
            <option value="all">All factors</option>
            {FACTOR_KEYS.map((key) => (
              <option key={key} value={key}>
                {formatKeyLabel(key)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-bold">Axis</span>
          <select
            value={axis}
            onChange={(event) =>
              setAxis(event.target.value as FactorAxisKey | "all")
            }
            className="h-9 w-full border border-black bg-white px-2"
          >
            <option value="all">All axes</option>
            {FACTOR_AXIS_KEYS.map((key) => (
              <option key={key} value={key}>
                {AXIS_LABELS[key]}
              </option>
            ))}
          </select>
        </label>
        <div className="text-sm">
          <span className="mb-1 block font-bold">Universe</span>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {UNIVERSE_KEYS.map((key) => (
              <label
                key={key}
                className="flex items-center gap-2 border border-gray-300 bg-white px-2 py-1"
              >
                <input
                  type="checkbox"
                  checked={selectedUniverseKeys.includes(key)}
                  onChange={() => toggleUniverse(key)}
                />
                <span>{UNIVERSE_LABELS[key]}</span>
              </label>
            ))}
          </div>
        </div>
      </section>

      {error ? (
        <section className="border border-red-700 bg-red-50 p-4 text-sm font-bold text-red-700">
          {error}
        </section>
      ) : null}

      <section className="space-y-4 border border-black bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="font-bold">Question Recommendation Summary</h2>
            <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
              <div className="border border-emerald-700 bg-emerald-50 p-2 text-emerald-800">
                <span className="block text-xs font-bold uppercase">Use</span>
                <span className="font-mono text-lg">{questionCounts.use}</span>
              </div>
              <div className="border border-amber-700 bg-amber-50 p-2 text-amber-800">
                <span className="block text-xs font-bold uppercase">Review</span>
                <span className="font-mono text-lg">{questionCounts.review}</span>
              </div>
              <div className="border border-red-700 bg-red-50 p-2 text-red-800">
                <span className="block text-xs font-bold uppercase">Hold</span>
                <span className="font-mono text-lg">{questionCounts.hold}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
            <button
              type="button"
              onClick={() => void copySummaryMarkdown()}
              disabled={questionSummaries.length === 0}
              className="inline-flex h-9 items-center justify-center gap-2 border border-black bg-white px-3 text-sm font-bold text-zinc-950 disabled:opacity-60"
            >
              <Clipboard className="h-4 w-4" />
              Copy MD
            </button>
            <button
              type="button"
              onClick={() => void refreshPolicyState()}
              disabled={questionSummaries.length === 0 || isPolicyRefreshing}
              className="inline-flex h-9 items-center justify-center gap-2 border border-black bg-[#173b35] px-3 text-sm font-bold text-white disabled:opacity-60"
            >
              <RefreshCw
                className={`h-4 w-4 ${isPolicyRefreshing ? "animate-spin" : ""}`}
              />
              Refresh Policy State
            </button>
            {policyNotice ? (
              <span className="text-xs text-gray-600">{policyNotice}</span>
            ) : null}
            {copyNotice ? (
              <span className="text-xs text-gray-600">{copyNotice}</span>
            ) : null}
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showRawTable}
                onChange={(event) => setShowRawTable(event.target.checked)}
              />
              Show raw validation table
            </label>
          </div>
        </div>

        <div className="grid gap-2">
          {questionSummaries.map((summary) => (
            <div
              key={`${summary.factor}:${summary.axis}`}
              className={`border p-3 ${getQuestionActionClassName(summary.action)}`}
            >
              <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-sm font-bold">
                    {getQuestionActionLabel(summary.action)}
                  </div>
                  <div className="mt-1 text-sm">
                    {formatKeyLabel(summary.factor)} / {AXIS_LABELS[summary.axis]}
                  </div>
                  <div className="mt-1 font-mono text-[11px]">
                    dominant={summary.dominantSignal?.signalKey ?? "-"}
                  </div>
                  {summary.manualPolicy ? (
                    <div className="mt-2 inline-block border border-current px-2 py-1 text-xs font-bold uppercase">
                      manual {summary.manualPolicy.status}
                    </div>
                  ) : null}
                </div>
                <div className="grid gap-1 text-right font-mono text-xs sm:grid-cols-4 lg:min-w-[420px]">
                  <span>no signal {formatPercent(summary.noSignalShare)}</span>
                  <span>directional {formatPercent(summary.directionalShare)}</span>
                  <span>mixed {formatPercent(summary.mixedShare)}</span>
                  <span>entropy {formatNumber(summary.entropy)}</span>
                </div>
              </div>
              <div className="mt-2 text-sm">
                {summary.reasons.join("; ")}.
              </div>
            </div>
          ))}
          {!isLoading && questionSummaries.length === 0 ? (
            <div className="border border-gray-300 bg-[#f5f5f5] p-4 text-center text-sm text-gray-600">
              No question summaries for the selected filters.
            </div>
          ) : null}
        </div>
      </section>

      {showRawTable ? (
      <section className="overflow-x-auto border border-black bg-white">
        <table className="min-w-[1320px] w-full border-collapse text-left text-xs">
          <thead className="bg-[#173b35] text-white">
            <tr>
              <th className="border-r border-white/30 px-2 py-2">Factor</th>
              <th className="border-r border-white/30 px-2 py-2">Axis</th>
              <th className="border-r border-white/30 px-2 py-2">Signal</th>
              <th className="border-r border-white/30 px-2 py-2 text-right">Count</th>
              <th className="border-r border-white/30 px-2 py-2 text-right">Share</th>
              <th className="border-r border-white/30 px-2 py-2 text-right">
                Mixed Share
              </th>
              <th className="border-r border-white/30 px-2 py-2 text-right">
                Median Driver
              </th>
              <th className="border-r border-white/30 px-2 py-2 text-right">
                P10 / P90
              </th>
              <th className="border-r border-white/30 px-2 py-2">Coverage</th>
              <th className="border-r border-white/30 px-2 py-2 text-right">
                Min Metrics
              </th>
              <th className="border-r border-white/30 px-2 py-2 text-right">
                Shadowed
              </th>
              <th className="border-r border-white/30 px-2 py-2">Top Sector</th>
              <th className="px-2 py-2">Examples</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={`${row.factor}:${row.axis}:${row.signalKey}`} className="odd:bg-[#f7f7f7]">
                <td className="border-r border-gray-200 px-2 py-2 align-top font-bold">
                  {formatKeyLabel(row.factor)}
                </td>
                <td className="border-r border-gray-200 px-2 py-2 align-top">
                  {AXIS_LABELS[row.axis]}
                </td>
                <td className="border-r border-gray-200 px-2 py-2 align-top">
                  <span className="block font-bold">{row.signalLabel}</span>
                  <span className="block font-mono text-[10px] text-gray-500">
                    {row.signalKey}
                  </span>
                </td>
                <td className="border-r border-gray-200 px-2 py-2 text-right align-top font-mono">
                  {formatCount(row.count)}
                </td>
                <td className="border-r border-gray-200 px-2 py-2 text-right align-top font-mono">
                  {formatPercent(row.share)}
                </td>
                <td className="border-r border-gray-200 px-2 py-2 text-right align-top font-mono">
                  {formatPercent(row.mixedShare)}
                </td>
                <td className="border-r border-gray-200 px-2 py-2 text-right align-top font-mono">
                  {formatNumber(row.medianDriver)}
                </td>
                <td className="border-r border-gray-200 px-2 py-2 text-right align-top font-mono">
                  {formatNumber(row.p10Driver)} / {formatNumber(row.p90Driver)}
                </td>
                <td className="border-r border-gray-200 px-2 py-2 align-top font-mono">
                  {formatCoverage(row)}
                </td>
                <td className="border-r border-gray-200 px-2 py-2 text-right align-top font-mono">
                  {formatPercent(row.minMetricsMetShare)}
                </td>
                <td className="border-r border-gray-200 px-2 py-2 text-right align-top font-mono">
                  {formatCount(row.shadowedCandidateCount)}
                </td>
                <td className="border-r border-gray-200 px-2 py-2 align-top">
                  {row.topSector ? (
                    <>
                      <span className="block">{row.topSector}</span>
                      <span className="block font-mono text-[10px] text-gray-500">
                        {formatPercent(row.topSectorShare)}
                      </span>
                    </>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="px-2 py-2 align-top">
                  <span className="block">
                    <span className="font-bold">Rep:</span>{" "}
                    {formatExamples(row.examples.representative)}
                  </span>
                  <span className="block">
                    <span className="font-bold">Near:</span>{" "}
                    {formatExamples(row.examples.threshold)}
                  </span>
                  <span className="block">
                    <span className="font-bold">Out:</span>{" "}
                    {formatExamples(row.examples.outliers)}
                  </span>
                </td>
              </tr>
            ))}
            {!isLoading && visibleRows.length === 0 ? (
              <tr>
                <td colSpan={13} className="px-3 py-6 text-center text-sm text-gray-600">
                  No signal validation rows for the selected filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
      ) : null}
    </main>
  );
}
