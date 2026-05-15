import type {
  SignalTimelineAxisScopeOption,
  TickerSignalCombinationTimelineSnapshot,
  TickerSignalCombinationTimelineOverview,
} from "@/shared/market/signalCombinationTimeline";
import type {
  TickerSignalCombinationFamilySignalSummary,
} from "@/shared/market/signalCombinationOverview";
import { getSignalCoreForwardBenchmarkTheme } from "@/shared/market/signalCoreForwardBenchmarks";

export type SignalTimelineForwardValidationSummary = {
  window: string;
  targetDate: string;
  observedCount: number;
  meanReturn: number | null;
  medianReturn: number | null;
};

export type SignalTimelineForwardValidationBenchmarkSummary = {
  ticker: string;
  window: string;
  targetDate: string;
  return: number | null;
};

export type SignalTimelineForwardValidation = {
  asOfDate: string;
  label: string;
  candidateBand: string;
  previousThreshold: number;
  peakThreshold: number;
  coreGroupCount: number;
  coreTickerCount: number;
  summaries: SignalTimelineForwardValidationSummary[];
  benchmarkTickers?: string[];
  benchmarkSummaries?: SignalTimelineForwardValidationBenchmarkSummary[];
};

const AXIS_DISPLAY_LABELS: Record<string, string> = {
  fundamentals_based: "Fundamentals",
  valuation: "Valuation",
  market_price: "Market price",
  etf_exposure: "ETF exposure",
  macro_linked: "Macro linked",
  narrative_implied: "Narrative implied",
};

export const TOP5_TURNOVER_WATCH_THRESHOLD = 4 / 7;
export const TOP5_TURNOVER_REGIME_THRESHOLD = 0.75;

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return `${(value * 100).toFixed(1)}%`;
}

function formatRatio(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return `${value.toFixed(2)}x`;
}

function formatSignedPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  const formatted = `${(value * 100).toFixed(1)}%`;

  return value > 0 ? `+${formatted}` : formatted;
}

function getBenchmarkTickers(
  validation: Pick<
    SignalTimelineForwardValidation,
    "benchmarkTickers" | "benchmarkSummaries"
  >,
) {
  const tickers = validation.benchmarkTickers?.length
    ? validation.benchmarkTickers
    : (validation.benchmarkSummaries ?? []).map((summary) => summary.ticker);

  return [...new Set(tickers.map((ticker) => ticker.toUpperCase()))].sort();
}

function formatKeyLabel(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getAxisDisplayLabel(
  signal: TickerSignalCombinationFamilySignalSummary["signal"],
) {
  return AXIS_DISPLAY_LABELS[signal.axis] ?? formatKeyLabel(signal.axis);
}

function getSignalDisplayLabel(
  signal: TickerSignalCombinationFamilySignalSummary["signal"],
) {
  return signal.signalLabel ?? formatKeyLabel(signal.signalKey);
}

function markdownCell(value: string | number) {
  return String(value).replaceAll("|", "\\|");
}

function formatMarkdownSignal(
  item:
    | TickerSignalCombinationFamilySignalSummary
    | {
        signal: TickerSignalCombinationFamilySignalSummary["signal"];
        share: number;
        lift?: number | null;
        baselineShare?: number;
        edgeCount?: number;
        averageSimilarity?: number;
      },
) {
  const parts = [
    `**${getSignalDisplayLabel(item.signal)}**`,
    `axis: ${getAxisDisplayLabel(item.signal)}`,
    `factor: ${formatKeyLabel(item.signal.factor)}`,
    `key: \`${item.signal.token}\``,
    `share: ${formatPercent(item.share)}`,
  ];

  if ("edgeCount" in item && item.edgeCount !== undefined) {
    parts.push(`boundary edges: ${item.edgeCount}`);
  }

  if ("baselineShare" in item && item.baselineShare !== undefined) {
    parts.push(`baseline: ${formatPercent(item.baselineShare)}`);
  }

  if ("lift" in item && item.lift !== undefined) {
    parts.push(`lift: ${formatRatio(item.lift)}`);
  }

  if ("averageSimilarity" in item && item.averageSimilarity !== undefined) {
    parts.push(`avg similarity: ${item.averageSimilarity.toFixed(2)}`);
  }

  return parts.join(" | ");
}

export function getSplitView(
  snapshot: TickerSignalCombinationTimelineSnapshot,
  split: "first" | "peak",
) {
  const views = snapshot.splitViews ?? [];
  const match = views.find((view) =>
    split === "first"
      ? view.analysis.label.includes("first largest")
      : view.analysis.label.includes("percolation split"),
  );

  if (match) return match;
  if (split === "peak" && snapshot.analysis) {
    return {
      analysis: snapshot.analysis,
      baselineSignals: snapshot.baselineSignals,
      boundarySignals: snapshot.boundarySignals,
      largestPieces: snapshot.largestPieces,
    };
  }

  return null;
}

function calculateSetTurnover(leftTokens: string[], rightTokens: string[]) {
  const left = new Set(leftTokens);
  const right = new Set(rightTokens);
  const union = new Set([...left, ...right]);

  if (union.size === 0) return null;

  let intersectionSize = 0;
  for (const token of left) {
    if (right.has(token)) intersectionSize += 1;
  }

  return 1 - intersectionSize / union.size;
}

export function calculateCoreIdentityTurnover(
  leftSnapshot: TickerSignalCombinationTimelineSnapshot,
  rightSnapshot: TickerSignalCombinationTimelineSnapshot,
) {
  const leftView = getSplitView(leftSnapshot, "peak");
  const rightView = getSplitView(rightSnapshot, "peak");
  const leftSignals = leftView?.baselineSignals ?? [];
  const rightSignals = rightView?.baselineSignals ?? [];
  const top5Turnover = calculateSetTurnover(
    leftSignals.slice(0, 5).map((item) => item.signal.token),
    rightSignals.slice(0, 5).map((item) => item.signal.token),
  );
  const weightedTop10Turnover = calculateWeightedSignalTurnover(
    leftSignals.slice(0, 10),
    rightSignals.slice(0, 10),
  );

  if (top5Turnover === null && weightedTop10Turnover === null) return null;

  return {
    top5Turnover,
    weightedTop10Turnover,
  };
}

export function previousYearSameQuarterDate(asOfDate: string) {
  const year = Number(asOfDate.slice(0, 4));
  if (!Number.isFinite(year)) return "";

  return `${year - 1}${asOfDate.slice(4, 10)}`;
}

function calculateWeightedSignalTurnover(
  leftSignals: TickerSignalCombinationFamilySignalSummary[],
  rightSignals: TickerSignalCombinationFamilySignalSummary[],
) {
  const leftShares = new Map(
    leftSignals.map((item) => [item.signal.token, item.share]),
  );
  const rightShares = new Map(
    rightSignals.map((item) => [item.signal.token, item.share]),
  );
  const tokens = new Set([...leftShares.keys(), ...rightShares.keys()]);

  if (tokens.size === 0) return null;

  let intersection = 0;
  let union = 0;

  for (const token of tokens) {
    const left = leftShares.get(token) ?? 0;
    const right = rightShares.get(token) ?? 0;

    intersection += Math.min(left, right);
    union += Math.max(left, right);
  }

  return union === 0 ? null : 1 - intersection / union;
}

export function percentile(values: number[], ratio: number) {
  if (values.length === 0) return null;

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * ratio) - 1),
  );

  return sorted[index];
}

function getCandidateBand(input: {
  top5YearTurnover: number | null;
  weightedYearTurnover: number | null;
  weightedWatchThreshold: number | null;
  weightedRegimeThreshold: number | null;
}) {
  const top5Year = input.top5YearTurnover ?? 0;
  const weightedYear = input.weightedYearTurnover ?? 0;
  const isRegime =
    top5Year >= TOP5_TURNOVER_REGIME_THRESHOLD ||
    (input.weightedRegimeThreshold !== null &&
      weightedYear >= input.weightedRegimeThreshold);
  const isWatch =
    isRegime ||
    top5Year >= TOP5_TURNOVER_WATCH_THRESHOLD ||
    (input.weightedWatchThreshold !== null &&
      weightedYear >= input.weightedWatchThreshold);

  return isRegime ? "regime-change candidate" : isWatch ? "watch" : "-";
}

type ForwardCohortRow = {
  cohort: "event" | "non-event";
  snapshotCount: number;
  window: string;
  observedCount: number;
  meanReturn: number | null;
  medianReturn: number | null;
  meanExcessReturn: number | null;
  benchmarkTicker: string | null;
};

function buildForwardCohortRows(
  validations: SignalTimelineForwardValidation[],
): ForwardCohortRow[] {
  const rows: ForwardCohortRow[] = [];

  for (const cohort of ["event", "non-event"] as const) {
    const cohortValidations = validations.filter((validation) =>
      cohort === "event"
        ? validation.candidateBand !== "-"
        : validation.candidateBand === "-",
    );

    for (const window of ["1M", "3M", "6M", "12M"]) {
      const summaries = cohortValidations
        .map((validation) =>
          validation.summaries.find((summary) => summary.window === window),
        )
        .filter(
          (summary): summary is SignalTimelineForwardValidationSummary =>
            summary !== undefined,
        );
      const meanValues = summaries
        .map((summary) => summary.meanReturn)
        .filter((value): value is number => value !== null);
      const medianValues = summaries
        .map((summary) => summary.medianReturn)
        .filter((value): value is number => value !== null);
      const benchmarkTicker = getPrimaryBenchmarkTicker(cohortValidations);
      const excessValues = benchmarkTicker
        ? cohortValidations.flatMap((validation) => {
            const summary = validation.summaries.find(
              (item) => item.window === window,
            );
            const benchmark = validation.benchmarkSummaries?.find(
              (item) =>
                item.window === window &&
                item.ticker.toUpperCase() === benchmarkTicker,
            );

            if (
              summary?.meanReturn === null ||
              summary?.meanReturn === undefined ||
              benchmark?.return === null ||
              benchmark?.return === undefined
            ) {
              return [];
            }

            return [summary.meanReturn - benchmark.return];
          })
        : [];

      rows.push({
        cohort,
        snapshotCount: cohortValidations.length,
        window,
        observedCount: summaries.reduce(
          (total, summary) => total + summary.observedCount,
          0,
        ),
        meanReturn: average(meanValues),
        medianReturn: average(medianValues),
        meanExcessReturn: average(excessValues),
        benchmarkTicker,
      });
    }
  }

  return rows;
}

function getPrimaryBenchmarkTicker(
  validations: SignalTimelineForwardValidation[],
) {
  const tickers = validations.flatMap(getBenchmarkTickers);

  if (tickers.includes("SPY")) return "SPY";

  return tickers[0] ?? null;
}

function average(values: number[]) {
  if (values.length === 0) return null;

  return values.reduce((total, value) => total + value, 0) / values.length;
}

export function buildSignalTimelineMarkdown(input: {
  overview: TickerSignalCombinationTimelineOverview;
  selectedSnapshot: TickerSignalCombinationTimelineSnapshot | null;
  scopeOption: SignalTimelineAxisScopeOption;
  forwardValidations?: SignalTimelineForwardValidation[];
  forwardCohortValidations?: SignalTimelineForwardValidation[];
  mode?: "compact" | "full";
}) {
  const {
    overview,
    selectedSnapshot,
    scopeOption,
    forwardValidations = [],
    forwardCohortValidations = [],
    mode = "full",
  } = input;
  const isCompact = mode === "compact";
  const snapshotsByDate = new Map(
    overview.snapshots.map((snapshot) => [snapshot.asOfDate, snapshot]),
  );
  const turnoverRows = overview.snapshots.flatMap((snapshot, index) => {
    const previousQuarter = overview.snapshots[index - 1] ?? null;
    const previousYearQuarter = snapshotsByDate.get(
      previousYearSameQuarterDate(snapshot.asOfDate),
    ) ?? null;
    const quarterTurnover = previousQuarter
      ? calculateCoreIdentityTurnover(previousQuarter, snapshot)
      : null;
    const yearTurnover = previousYearQuarter
      ? calculateCoreIdentityTurnover(previousYearQuarter, snapshot)
      : null;

    if (!quarterTurnover && !yearTurnover) return [];

    return [{
      snapshot,
      top5QuarterTurnover: quarterTurnover?.top5Turnover ?? null,
      weightedQuarterTurnover: quarterTurnover?.weightedTop10Turnover ?? null,
      top5YearTurnover: yearTurnover?.top5Turnover ?? null,
      weightedYearTurnover: yearTurnover?.weightedTop10Turnover ?? null,
    }];
  });
  const weightedYearValues = turnoverRows
    .map((row) => row.weightedYearTurnover)
    .filter((value): value is number => value !== null);
  const weightedWatchThreshold = percentile(weightedYearValues, 0.8);
  const weightedRegimeThreshold = percentile(weightedYearValues, 0.9);
  const candidateBandByDate = new Map(
    turnoverRows.map((row) => [
      row.snapshot.asOfDate,
      getCandidateBand({
        top5YearTurnover: row.top5YearTurnover,
        weightedYearTurnover: row.weightedYearTurnover,
        weightedWatchThreshold,
        weightedRegimeThreshold,
      }),
    ]),
  );
  const coreSizeSnapshots = isCompact
    ? overview.snapshots.filter(
        (snapshot) =>
          candidateBandByDate.get(snapshot.asOfDate) !== "-" ||
          snapshot.asOfDate === selectedSnapshot?.asOfDate,
      )
    : overview.snapshots;
  const lines: string[] = [
    "# Signal Network Split Timeline",
    "",
    "## Context",
    "",
    `- Axis lens: **${scopeOption.label}**`,
    `- Axis scope key: \`${overview.axisScope}\``,
    `- Description: ${scopeOption.description}`,
    `- Frequency: ${overview.frequency}`,
    `- Lookback setting: ${overview.years} years`,
    `- Generated at: ${overview.generatedAt}`,
    `- Snapshot count: ${overview.snapshots.length}`,
    isCompact
      ? "- Export mode: compact copy for LLM review. Full per-snapshot identity flow and benchmark detail are available in the downloaded MD."
      : "- Export mode: full archive.",
    "- Latest snapshot caveat: the latest snapshot is not a complete calendar-year or quarter-end snapshot. SEC-derived axes should generally be interpreted as available-through the latest completed SEC reporting cycle, while price-linked axes may reflect newer market-price data.",
    "",
    "## How To Read This Export",
    "",
    "- Core size context tracks the largest component share immediately before the peak-fragmentation split.",
    "- Market core identity flow lists top baseline signals inside the largest component before that split.",
    "- Core identity turnover compares the peak-fragmentation market core baseline against the previous quarter and the same quarter one year earlier.",
    "- Forward return validation summarizes future returns for tickers inside candidate-event pre-break market cores.",
    "- Selected snapshot diagnostics list boundary connecting signals, meaning signals shared by cross-piece edges that disappear at the split.",
    "- This is a threshold-percolation view of a signal-similarity graph. It is intended to describe market structure, not to prove causality.",
    "",
    "## Method Definitions",
    "",
    "### Unit Of Analysis",
    "",
    "- **Ticker**: one company/security in the active universe for the snapshot.",
    "- **Signal**: one selected factor-axis state, such as `quality.fundamentals_based.cash_backed_earnings`.",
    "- **Signal set**: the active directional signals attached to a ticker at a snapshot date. Mixed/default states are treated as non-directional context rather than active Jaccard signals.",
    "- **Group**: an exact signal-set combination. Multiple tickers can belong to one group if they have exactly the same active signal set. If most tickers have unique combinations, group count can be close to ticker count. The network nodes in this export are groups, not individual tickers.",
    "- **Edge**: a connection between two groups when their signal-set similarity is at or above the threshold.",
    "",
    "### Similarity And Percolation",
    "",
    "- **IDF-weighted Jaccard similarity**: shared active signals divided by the weighted union of active signals, with rarer signals receiving more weight. This reduces the dominance of very common broad signals.",
    "- **Threshold**: the minimum similarity required for an edge to remain in the graph. As the threshold rises, weakly similar group pairs lose edges and the graph fragments.",
    "- **Largest component**: the largest connected component of group nodes at a threshold.",
    "- **Largest Before**: size of the largest component immediately before the reported split threshold.",
    "- **Largest After**: size of the largest piece after the threshold is raised and the split occurs.",
    "- **Largest Share**: `Largest Before / Groups`. This measures how much of the group network is still connected immediately before the split.",
    "",
    "### Peak Fragmentation And Second Moment",
    "",
    "- **Second Moment**: the finite-component second moment around a threshold, computed from the post-split component-size distribution while excluding the largest component. It emphasizes medium-sized fragments.",
    "- A high second moment does not automatically mean the market is healthier or worse. It means fragmentation is structurally visible through sizable non-giant pieces.",
    "- A lower second moment during a severe split can mean the graph broke into one large piece plus many small fragments, rather than several medium-sized communities.",
    "- **Peak fragmentation split**: the threshold transition where the finite-component second moment is highest in the scanned threshold grid.",
    "",
    "### Baseline And Boundary Signals",
    "",
    "- **Market core baseline signals**: the most common active signals inside the largest component immediately before the peak-fragmentation split.",
    "- **Boundary connecting signals**: active signals shared on removed cross-piece edges whose endpoints land in different pieces after the split.",
    "- Boundary connecting signals are not causal drivers. They are weak common denominators that were still shared by group pairs right before those pairs disconnected.",
    "- **Lift**: boundary share divided by baseline share. Lift above 1 means the signal is more concentrated on disappearing boundary edges than in the pre-split core baseline.",
    "",
    "### Forward Return Validation",
    "",
    "- **Validation event**: a timeline snapshot whose core identity turnover is classified as watch or regime-change candidate.",
    "- **Validated universe**: tickers inside the largest component immediately before the peak-fragmentation split for that event.",
    "- **Forward windows**: returns are calculated from the first available trading close on or after the event date to the first available trading close on or after each target date.",
    "- Forward returns are descriptive validation targets, not evidence that the signal network caused later returns.",
    "",
    "### Regime-Change Candidate Rules",
    "",
    `- **Top5 YoY watch threshold**: ${TOP5_TURNOVER_WATCH_THRESHOLD.toFixed(3)}. This roughly means two of the top five core identity signals changed versus the same quarter last year.`,
    `- **Top5 YoY regime-change candidate threshold**: ${TOP5_TURNOVER_REGIME_THRESHOLD.toFixed(3)}. This roughly means three of the top five core identity signals changed versus the same quarter last year.`,
    `- **Top10 weighted YoY watch threshold**: ${
      weightedWatchThreshold === null ? "not available" : weightedWatchThreshold.toFixed(3)
    }. This is the 80th percentile inside the selected axis lens.`,
    `- **Top10 weighted YoY regime-change candidate threshold**: ${
      weightedRegimeThreshold === null ? "not available" : weightedRegimeThreshold.toFixed(3)
    }. This is the 90th percentile inside the selected axis lens.`,
    "",
    "## Interpretation Cautions",
    "",
    "- `Groups` should not be read as connected components. Groups are exact signal-set combinations; connected components are formed later by similarity edges between those groups.",
    "- `Groups ≈ Tickers` is possible and not contradictory. It means most tickers have unique exact signal combinations, while similarity edges can still connect many unique groups into a large component.",
    "- Quarter-end snapshots can still miss intra-quarter shocks. A crisis that occurs and reverses before quarter-end may appear only indirectly.",
    "- Boundary lift values near 1 imply boundary edges are not very different from the core baseline. Stronger interpretation requires repeated appearance across dates or lenses.",
    "- Axis-specific lenses should be compared with care. All-axes combines several data sources, while fundamentals and price-linked views isolate narrower signal spaces.",
    "",
    "## Core Size Context",
    "",
    "| Date | Label | Tickers | Groups | Signals | Threshold | Largest Before | Largest Share | Largest After | Boundary Edges | Second Moment |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];

  for (const snapshot of coreSizeSnapshots) {
    const analysis = snapshot.analysis;

    lines.push(
      `| ${[
        snapshot.asOfDate,
        markdownCell(snapshot.label),
        snapshot.tickerCount,
        snapshot.groupCount,
        snapshot.signalDimensionCount,
        analysis ? `${analysis.previousThreshold.toFixed(2)} -> ${analysis.peakThreshold.toFixed(2)}` : "-",
        analysis?.largestBeforeSize ?? "-",
        analysis ? formatPercent(analysis.largestBeforeSize / Math.max(1, snapshot.groupCount)) : "-",
        analysis?.largestAfterSize ?? "-",
        analysis?.bridgeEdgeCount ?? "-",
        analysis ? analysis.peakMoment.toFixed(1) : "-",
      ].join(" | ")} |`,
    );
  }

  lines.push(
    "",
    "## Core Identity Turnover",
    "",
    "| Date | Label | Top5 vs Prev Quarter | Top10 Weighted vs Prev Quarter | Top5 vs Same Quarter Last Year | Top10 Weighted vs Same Quarter Last Year | Candidate Band |",
    "| --- | --- | ---: | ---: | ---: | ---: | --- |",
  );

  if (turnoverRows.length === 0) {
    lines.push("| None | - | - | - | - | - | - |");
  } else {
    for (const row of turnoverRows) {
      const candidateBand = candidateBandByDate.get(row.snapshot.asOfDate) ?? "-";

      if (isCompact && candidateBand === "-") continue;

      lines.push(
        `| ${[
          row.snapshot.asOfDate,
          markdownCell(row.snapshot.label),
          row.top5QuarterTurnover === null ? "-" : row.top5QuarterTurnover.toFixed(3),
          row.weightedQuarterTurnover === null ? "-" : row.weightedQuarterTurnover.toFixed(3),
          row.top5YearTurnover === null ? "-" : row.top5YearTurnover.toFixed(3),
          row.weightedYearTurnover === null ? "-" : row.weightedYearTurnover.toFixed(3),
          candidateBand,
        ].join(" | ")} |`,
      );
    }
  }

  lines.push("", "## Forward Return Validation", "");

  if (forwardValidations.length === 0) {
    lines.push(
      "No forward return validation rows were included in this export.",
      "",
    );
  } else {
    lines.push(
      "| Date | Label | Candidate Band | Threshold | Core Nodes | Core Tickers | Benchmarks | +1M Mean | +1M Median | +1M Obs | +3M Mean | +3M Median | +3M Obs | +6M Mean | +6M Median | +6M Obs | +12M Mean | +12M Median | +12M Obs |",
      "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    );

    for (const validation of forwardValidations) {
      const summariesByWindow = new Map(
        validation.summaries.map((summary) => [summary.window, summary]),
      );
      const benchmarkTickers = getBenchmarkTickers(validation);
      const cells = ["1M", "3M", "6M", "12M"].flatMap((window) => {
        const summary = summariesByWindow.get(window);

        return [
          formatSignedPercent(summary?.meanReturn),
          formatSignedPercent(summary?.medianReturn),
          summary?.observedCount ?? "-",
        ];
      });

      lines.push(
        `| ${[
          validation.asOfDate,
          markdownCell(validation.label),
          markdownCell(validation.candidateBand),
          `${validation.previousThreshold.toFixed(2)} -> ${validation.peakThreshold.toFixed(2)}`,
          validation.coreGroupCount,
          validation.coreTickerCount,
          benchmarkTickers.length,
          ...cells,
        ].join(" | ")} |`,
      );
    }

    lines.push(
      "",
      "### Forward Return Benchmark Detail",
      "",
      "| Date | Label | Window | Ticker | Theme | Target Date | Return |",
      "| --- | --- | --- | --- | --- | --- | ---: |",
    );

    if (isCompact) {
      lines.push(
        "| Omitted in compact copy | Use Download MD for all benchmark-by-window details. | - | - | - | - | - |",
      );
    } else {
      for (const validation of forwardValidations) {
      const benchmarkByWindowTicker = new Map(
        (validation.benchmarkSummaries ?? []).map((summary) => [
          `${summary.window}:${summary.ticker.toUpperCase()}`,
          summary,
        ]),
      );

      for (const window of ["1M", "3M", "6M", "12M"]) {
        for (const ticker of getBenchmarkTickers(validation)) {
          const benchmark = benchmarkByWindowTicker.get(`${window}:${ticker}`);

          lines.push(
            `| ${[
              validation.asOfDate,
              markdownCell(validation.label),
              `+${window}`,
              ticker,
              markdownCell(getSignalCoreForwardBenchmarkTheme(ticker)),
              benchmark?.targetDate ?? "-",
              formatSignedPercent(benchmark?.return),
            ].join(" | ")} |`,
          );
        }
      }
    }
    }

    lines.push("");
  }

  if (!isCompact) {
    lines.push(
      "",
      "## Event vs Non-Event Forward Return Summary",
      "",
      "This section compares cached forward returns for validation-event snapshots against cached non-event snapshots in the same axis lens. Event status is a cohort label, not a causal claim.",
      "",
    );

    const cohortRows = buildForwardCohortRows(forwardCohortValidations);

    if (cohortRows.length === 0) {
      lines.push(
        "No cached event/non-event cohort rows were available for this export.",
        "",
      );
    } else {
      lines.push(
        "| Cohort | Cached Snapshots | Window | Observed | Mean Return | Median Return | Mean Excess vs Benchmark | Benchmark |",
        "| --- | ---: | --- | ---: | ---: | ---: | ---: | --- |",
      );

      for (const row of cohortRows) {
        lines.push(
          `| ${[
            row.cohort,
            row.snapshotCount,
            `+${row.window}`,
            row.observedCount,
            formatSignedPercent(row.meanReturn),
            formatSignedPercent(row.medianReturn),
            formatSignedPercent(row.meanExcessReturn),
            row.benchmarkTicker ?? "-",
          ].join(" | ")} |`,
        );
      }

      lines.push("");
    }
  }

  if (!isCompact) {
    lines.push("", "## Market Core Identity Flow", "");

    for (const snapshot of overview.snapshots) {
      const view = getSplitView(snapshot, "peak");
      const analysis = view?.analysis ?? snapshot.analysis;

      lines.push(`### ${snapshot.label} (${snapshot.asOfDate})`, "");
      lines.push(
        analysis
          ? `- Split: threshold ${analysis.previousThreshold.toFixed(2)} -> ${analysis.peakThreshold.toFixed(2)}, largest before ${analysis.largestBeforeSize}, largest after ${analysis.largestAfterSize}, boundary edges ${analysis.bridgeEdgeCount}.`
          : "- Split: not available.",
      );
      lines.push("- Top baseline signals:");

      if (!view?.baselineSignals.length) {
        lines.push("  - None");
      } else {
        for (const signal of view.baselineSignals.slice(0, 5)) {
          lines.push(`  - ${formatMarkdownSignal(signal)}`);
        }
      }

      lines.push("");
    }
  } else if (selectedSnapshot) {
    const view = getSplitView(selectedSnapshot, "peak");
    lines.push("", "## Selected Core Identity", "");
    lines.push(`### ${selectedSnapshot.label} (${selectedSnapshot.asOfDate})`, "");
    lines.push("- Top baseline signals:");
    if (!view?.baselineSignals.length) {
      lines.push("  - None");
    } else {
      for (const signal of view.baselineSignals.slice(0, 5)) {
        lines.push(`  - ${formatMarkdownSignal(signal)}`);
      }
    }
    lines.push("");
  }

  lines.push("## Selected Snapshot Boundary Diagnostics", "");

  if (!selectedSnapshot) {
    lines.push("No selected snapshot.");
  } else {
    const analysis = selectedSnapshot.analysis;

    lines.push(`- Selected date: ${selectedSnapshot.asOfDate}`);
    lines.push(`- Selected label: ${selectedSnapshot.label}`);
    if (analysis) {
      lines.push(
        `- Split: threshold ${analysis.previousThreshold.toFixed(2)} -> ${analysis.peakThreshold.toFixed(2)}, boundary edges ${analysis.bridgeEdgeCount}, removed edges ${analysis.removedEdgeCount}.`,
      );
    }
    lines.push("", "| Signal | Axis | Factor | Share | Baseline | Lift | Boundary Edges | Avg Similarity | Token |");
    lines.push("| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |");

    if (selectedSnapshot.boundarySignals.length === 0) {
      lines.push("| None | - | - | - | - | - | - | - | - |");
    } else {
      for (const signal of selectedSnapshot.boundarySignals) {
        lines.push(
          `| ${[
            markdownCell(getSignalDisplayLabel(signal.signal)),
            markdownCell(getAxisDisplayLabel(signal.signal)),
            markdownCell(formatKeyLabel(signal.signal.factor)),
            formatPercent(signal.share),
            formatPercent(signal.baselineShare),
            formatRatio(signal.lift),
            signal.edgeCount,
            signal.averageSimilarity.toFixed(2),
            `\`${signal.signal.token}\``,
          ].join(" | ")} |`,
        );
      }
    }
  }

  lines.push(
    "",
    "## Raw Interpretation Prompt",
    "",
    "Use the tables and definitions above to interpret how the market core changes through time. First distinguish exact signal-set groups from connected components. Then focus on recurring baseline signals, changes in largest component share, and boundary connecting signals in the selected snapshot. Treat second moment as a fragmentation statistic, not as a direct health score. Avoid treating boundary signals as causal drivers; interpret them as weak shared common denominators on disappearing cross-piece edges.",
    "",
  );

  return lines.join("\n");
}
