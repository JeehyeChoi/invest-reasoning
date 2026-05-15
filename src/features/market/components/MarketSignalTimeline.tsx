"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import type {
  SignalTimelineAxisScope,
  TickerSignalCombinationTimelineAnalysis,
  TickerSignalCombinationTimelineOverview,
  TickerSignalCombinationTimelineSnapshot,
} from "@/shared/market/signalCombinationTimeline";
import {
  SIGNAL_TIMELINE_AXIS_SCOPE_OPTIONS,
} from "@/shared/market/signalCombinationTimeline";
import { getSignalCoreForwardBenchmarkTheme } from "@/shared/market/signalCoreForwardBenchmarks";
import type {
  TickerSignalCombinationFamilySignalSummary,
} from "@/shared/market/signalCombinationOverview";
import { fetchSignalCombinationTimeline } from "@/features/market/services/fetchSignalCombinationTimeline";
import {
  fetchCachedSignalCoreForwardReturns,
  type SignalCoreForwardReturns,
} from "@/features/market/services/fetchSignalCoreForwardReturns";
import {
  WorkstationFrame,
  WorkstationPanel,
} from "@/features/workstation/components/WorkstationChrome";
import {
  buildSignalTimelineMarkdown,
  calculateCoreIdentityTurnover,
  getSplitView,
  percentile,
  previousYearSameQuarterDate,
  type SignalTimelineForwardValidation,
  TOP5_TURNOVER_REGIME_THRESHOLD,
  TOP5_TURNOVER_WATCH_THRESHOLD,
} from "@/features/market/utils/buildSignalTimelineMarkdown";

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

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatSignedPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "-";
  }

  const formatted = `${(value * 100).toFixed(1)}%`;

  return value > 0 ? `+${formatted}` : formatted;
}

function isFutureDate(value: string | null | undefined) {
  if (!value) return false;
  const targetTime = new Date(`${value}T00:00:00.000Z`).getTime();
  if (!Number.isFinite(targetTime)) return false;

  return targetTime > Date.now();
}

function formatObservedCount(input: {
  observedCount: number;
  targetDate: string;
}) {
  return input.observedCount === 0 && isFutureDate(input.targetDate)
    ? "Pending"
    : formatNumber(input.observedCount);
}

const AXIS_DISPLAY_LABELS: Record<string, string> = {
  fundamentals_based: "Fundamentals",
  valuation: "Valuation",
  market_price: "Market price",
  etf_exposure: "ETF exposure",
  macro_linked: "Macro linked",
  narrative_implied: "Narrative implied",
};

function formatKeyLabel(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getBenchmarkTickers(result: Pick<
  SignalCoreForwardReturns,
  "benchmarkTickers" | "benchmarkSummaries"
>) {
  const tickers = result.benchmarkTickers.length
    ? result.benchmarkTickers
    : result.benchmarkSummaries.map((summary) => summary.ticker);

  return [...new Set(tickers.map((ticker) => ticker.toUpperCase()))].sort();
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

function SignalDisplayName({
  signal,
}: {
  signal: TickerSignalCombinationFamilySignalSummary["signal"];
}) {
  return (
    <span className="block min-w-0">
      <span className="block break-words font-medium text-zinc-700">
        {getSignalDisplayLabel(signal)}
      </span>
      <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.08em] text-zinc-400">
        {getAxisDisplayLabel(signal)}
      </span>
    </span>
  );
}

const SIGNAL_FLOW_COLORS = [
  "#173b35",
  "#8a4b24",
  "#315b8a",
  "#6f3d7a",
  "#8a6f24",
  "#28665f",
  "#8a3348",
  "#4e5f2b",
  "#355078",
  "#6a4f2a",
];

const AXIS_FLOW_STYLES: Record<string, {
  base: string;
  variants: string[];
  order: number;
}> = {
  fundamentals_based: {
    base: "#008b8b",
    variants: ["#008b8b", "#007a7a", "#009c9c", "#006969"],
    order: 1,
  },
  valuation: {
    base: "#ff6b00",
    variants: ["#ff6b00", "#e85f00", "#d95500", "#c94f00"],
    order: 2,
  },
  market_price: {
    base: "#0057ff",
    variants: ["#0057ff", "#004ce0", "#0066cc", "#003eb8"],
    order: 3,
  },
  etf_exposure: {
    base: "#7a00cc",
    variants: ["#7a00cc", "#6900b3", "#8a00e6", "#5a0099"],
    order: 4,
  },
  macro_linked: {
    base: "#d0003b",
    variants: ["#d0003b", "#b80034", "#e00044", "#99002c"],
    order: 5,
  },
};

function colorForSignalToken(token: string) {
  let hash = 0;

  for (let index = 0; index < token.length; index += 1) {
    hash = (hash * 31 + token.charCodeAt(index)) % SIGNAL_FLOW_COLORS.length;
  }

  return SIGNAL_FLOW_COLORS[Math.abs(hash) % SIGNAL_FLOW_COLORS.length];
}

function colorForSignalAxis(input: { axis: string; token: string }) {
  const style = AXIS_FLOW_STYLES[input.axis];
  if (!style) return colorForSignalToken(input.token);

  let hash = 0;

  for (let index = 0; index < input.token.length; index += 1) {
    hash = (hash * 31 + input.token.charCodeAt(index)) % style.variants.length;
  }

  return style.variants[Math.abs(hash) % style.variants.length];
}

function getAxisOrder(axis: string) {
  return AXIS_FLOW_STYLES[axis]?.order ?? 99;
}

function buildSnapshotRead(snapshot: TickerSignalCombinationTimelineSnapshot) {
  const analysis = snapshot.analysis;
  if (!analysis) return "No percolation split is available for this date.";

  const baseline = snapshot.baselineSignals
    .slice(0, 2)
    .map(
      (item) =>
        `${getAxisDisplayLabel(item.signal)} / ${getSignalDisplayLabel(
          item.signal,
        )} ${formatPercent(item.share)}`,
    )
    .join(" / ");
  const boundary = snapshot.boundarySignals
    .filter((item) => (item.lift ?? 0) >= 1.2)
    .slice(0, 2)
    .map(
      (item) =>
        `${getAxisDisplayLabel(item.signal)} / ${getSignalDisplayLabel(
          item.signal,
        )} ${formatRatio(item.lift)}`,
    )
    .join(" / ");
  const piece = snapshot.largestPieces[0];
  const identity = piece?.topSignals
    .slice(0, 2)
    .map(
      (item) =>
        `${getAxisDisplayLabel(item.signal)} / ${getSignalDisplayLabel(
          item.signal,
        )}`,
    )
    .join(" + ");

  return [
    baseline ? `Baseline: ${baseline}.` : null,
    boundary ? `Boundary lift: ${boundary}.` : "Boundary lift is thin.",
    identity ? `Largest piece: ${identity}.` : null,
    `Core before split ${analysis.largestBeforeSize.toLocaleString()} groups at threshold ${analysis.previousThreshold.toFixed(2)}.`,
  ]
    .filter(Boolean)
    .join(" ");
}

function downloadMarkdownFile(input: { filename: string; markdown: string }) {
  const blob = new Blob([input.markdown], {
    type: "text/markdown;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = input.filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function copyTextToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return fallbackCopyTextToClipboard(text);
  }
}

function fallbackCopyTextToClipboard(text: string) {
  const textarea = document.createElement("textarea");

  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}

function snapshotTime(snapshot: TickerSignalCombinationTimelineSnapshot) {
  return Date.parse(`${snapshot.asOfDate}T00:00:00.000Z`);
}

function buildTimelineXScale(input: {
  snapshots: TickerSignalCombinationTimelineSnapshot[];
  left: number;
  right: number;
}) {
  const times = input.snapshots.map(snapshotTime).filter(Number.isFinite);
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);

  if (!Number.isFinite(minTime) || !Number.isFinite(maxTime) || minTime === maxTime) {
    return () => (input.left + input.right) / 2;
  }

  return (snapshot: TickerSignalCombinationTimelineSnapshot) => {
    const time = snapshotTime(snapshot);

    return input.left + ((time - minTime) / (maxTime - minTime)) * (input.right - input.left);
  };
}

function timelineYearSpan(snapshots: TickerSignalCombinationTimelineSnapshot[]) {
  const years = snapshots
    .map((snapshot) => Number(snapshot.asOfDate.slice(0, 4)))
    .filter(Number.isFinite);

  if (years.length === 0) return 1;
  return Math.max(1, Math.max(...years) - Math.min(...years) + 1);
}

function isTimelineYearTick(
  snapshot: TickerSignalCombinationTimelineSnapshot,
  index: number,
  snapshots: TickerSignalCombinationTimelineSnapshot[],
) {
  if (index === 0) return true;
  if (snapshot.label === "Latest") return true;

  const previous = snapshots[index - 1];
  return snapshot.asOfDate.slice(0, 4) !== previous.asOfDate.slice(0, 4);
}

function timelineYearTickLabel(
  snapshot: TickerSignalCombinationTimelineSnapshot,
  index: number,
  snapshots: TickerSignalCombinationTimelineSnapshot[],
) {
  if (snapshot.label === "Latest") return "Latest";
  return isTimelineYearTick(snapshot, index, snapshots)
    ? snapshot.asOfDate.slice(0, 4)
    : null;
}

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const updateWidth = () => {
      setWidth(element.getBoundingClientRect().width);
    };
    const observer = new ResizeObserver(updateWidth);

    updateWidth();
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  return [ref, width] as const;
}

function TimelineChart({
  snapshots,
  selectedDate,
  onSelect,
}: {
  snapshots: TickerSignalCombinationTimelineSnapshot[];
  selectedDate: string;
  onSelect: (date: string) => void;
}) {
  const hasAnalysis = snapshots.some((snapshot) => snapshot.analysis !== null);
  if (!hasAnalysis) {
    return (
      <div className="border border-zinc-200 bg-white p-5 text-sm leading-6 text-zinc-600">
        No connected market core split is available for this axis lens. The
        signal groups do not share positive similarity edges under the current
        percolation model.
      </div>
    );
  }

  const [containerRef, containerWidth] = useElementWidth<HTMLDivElement>();
  const width = Math.max(
    900,
    containerWidth,
    timelineYearSpan(snapshots) * 46 + 120,
  );
  const height = 220;
  const padding = { top: 24, right: 24, bottom: 42, left: 52 };
  const xForSnapshot = buildTimelineXScale({
    snapshots,
    left: padding.left,
    right: width - padding.right,
  });
  const series = [
    {
      key: "peak",
      label: "peak fragmentation",
      color: "#173b35",
      getAnalysis: (snapshot: TickerSignalCombinationTimelineSnapshot) =>
        getSplitView(snapshot, "peak")?.analysis ?? snapshot.analysis,
    },
  ];
  const values = snapshots.flatMap((snapshot) =>
    series.flatMap((item) => {
      const analysis = item.getAnalysis(snapshot);
      if (!analysis || snapshot.groupCount === 0) return [];
      return [analysis.largestBeforeSize / snapshot.groupCount];
    }),
  );
  const maxValue = Math.max(1, ...values);
  const buildPoints = (
    item: (typeof series)[number],
  ) => snapshots.flatMap((snapshot, index) => {
    const analysis = item.getAnalysis(snapshot);
    if (!analysis || snapshot.groupCount === 0) return [];

    const value = analysis.largestBeforeSize / snapshot.groupCount;
    const x = xForSnapshot(snapshot);
    const y =
      height -
      padding.bottom -
      (value / maxValue) * (height - padding.top - padding.bottom);

    return [{ snapshot, value, x, y, snapshotIndex: index }];
  });
  const yTicks = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    const value = maxValue * (1 - ratio);
    const y =
      padding.top + ratio * (height - padding.top - padding.bottom);

    return { value, y };
  });

  return (
    <div ref={containerRef} className="overflow-x-auto border border-zinc-200 bg-white">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label="Annual market core share before split timeline"
      >
        <line
          x1={padding.left}
          y1={height - padding.bottom}
          x2={width - padding.right}
          y2={height - padding.bottom}
          stroke="#d4d4d8"
        />
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={height - padding.bottom}
          stroke="#d4d4d8"
        />
        {yTicks.map((tick) => (
          <g key={`${tick.value}-${tick.y}`}>
            <line
              x1={padding.left}
              y1={tick.y}
              x2={width - padding.right}
              y2={tick.y}
              stroke="#f1f1f2"
            />
            <text
              x={padding.left - 8}
              y={tick.y + 3}
              textAnchor="end"
              className="fill-zinc-500 font-mono text-[10px]"
            >
              {formatPercent(tick.value)}
            </text>
          </g>
        ))}
        {series.map((item) => {
          const points = buildPoints(item);
          const path = points
            .map((point, index) => {
              const previous = points[index - 1];
              const command =
                index === 0 || point.snapshotIndex - previous.snapshotIndex !== 1
                  ? "M"
                  : "L";

              return `${command} ${point.x} ${point.y}`;
            })
            .join(" ");

          return (
            <g key={item.key}>
              <path d={path} fill="none" stroke={item.color} strokeWidth={2.5} />
              {points.map((point) => {
                const selected = point.snapshot.asOfDate === selectedDate;

                return (
                  <g
                    key={`${item.key}-${point.snapshot.asOfDate}`}
                    className="cursor-pointer"
                    onClick={() => onSelect(point.snapshot.asOfDate)}
                  >
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={selected ? 5 : 3.5}
                      fill={selected ? "#b88a2f" : item.color}
                      stroke="#fff"
                      strokeWidth={2}
                    />
                  </g>
                );
              })}
            </g>
          );
        })}
        {snapshots.map((snapshot, index) => {
          const x = xForSnapshot(snapshot);
          const label = timelineYearTickLabel(snapshot, index, snapshots);
          const selected = snapshot.asOfDate === selectedDate;

          return (
            <g
              key={snapshot.asOfDate}
              className="cursor-pointer"
              onClick={() => onSelect(snapshot.asOfDate)}
            >
              <line
                x1={x}
                y1={height - padding.bottom}
                x2={x}
                y2={height - padding.bottom + (label ? 10 : 5)}
                stroke={selected ? "#b88a2f" : label ? "#a1a1aa" : "#d4d4d8"}
                strokeWidth={selected || label ? 1.5 : 1}
              />
              <text
                x={x}
                y={height - 17}
                textAnchor="middle"
                className={
                  label
                    ? "fill-zinc-500 font-mono text-[10px]"
                    : "fill-transparent font-mono text-[8px]"
                }
              >
                {label ?? ""}
              </text>
            </g>
          );
        })}
        {series.map((item, index) => (
          <g key={`legend-${item.key}`}>
            <line
              x1={width - padding.right - 170}
              y1={14 + index * 16}
              x2={width - padding.right - 148}
              y2={14 + index * 16}
              stroke={item.color}
              strokeWidth={2.5}
            />
            <text
              x={width - padding.right - 140}
              y={18 + index * 16}
              className="fill-zinc-500 font-mono text-[10px]"
            >
              {item.label}
            </text>
          </g>
        ))}
        <text
          x={padding.left}
          y={15}
          className="fill-zinc-500 font-mono text-[10px]"
        >
          largest component share at pre-split threshold
        </text>
      </svg>
    </div>
  );
}

function CoreIdentityTurnoverChart({
  snapshots,
  selectedDate,
  onSelect,
}: {
  snapshots: TickerSignalCombinationTimelineSnapshot[];
  selectedDate: string;
  onSelect: (date: string) => void;
}) {
  const [containerRef, containerWidth] = useElementWidth<HTMLDivElement>();
  const width = Math.max(
    900,
    containerWidth,
    timelineYearSpan(snapshots) * 46 + 120,
  );
  const height = 230;
  const padding = { top: 28, right: 24, bottom: 46, left: 52 };
  const xForSnapshot = buildTimelineXScale({
    snapshots,
    left: padding.left,
    right: width - padding.right,
  });
  const snapshotsByDate = new Map(
    snapshots.map((snapshot) => [snapshot.asOfDate, snapshot]),
  );
  const turnoverPoints = snapshots.flatMap((snapshot, index) => {
    const previousQuarter = snapshots[index - 1] ?? null;
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
      previousQuarter,
      previousYearQuarter,
      top5QuarterTurnover: quarterTurnover?.top5Turnover ?? null,
      weightedQuarterTurnover: quarterTurnover?.weightedTop10Turnover ?? null,
      top5YearTurnover: yearTurnover?.top5Turnover ?? null,
      weightedYearTurnover: yearTurnover?.weightedTop10Turnover ?? null,
    }];
  });

  if (turnoverPoints.length === 0) {
    return null;
  }

  const weightedYearValues = turnoverPoints
    .map((point) => point.weightedYearTurnover)
    .filter((value): value is number => value !== null);
  const weightedWatchThreshold = percentile(weightedYearValues, 0.8);
  const weightedRegimeThreshold = percentile(weightedYearValues, 0.9);
  const regimeBands = turnoverPoints.flatMap((point) => {
    const x = xForSnapshot(point.snapshot);
    const snapshotIndex = snapshots.findIndex(
      (snapshot) => snapshot.asOfDate === point.snapshot.asOfDate,
    );
    const previousSnapshot = snapshots[snapshotIndex - 1] ?? null;
    const nextSnapshot = snapshots[snapshotIndex + 1] ?? null;
    const previousX = previousSnapshot
      ? xForSnapshot(previousSnapshot)
      : padding.left;
    const nextX = nextSnapshot ? xForSnapshot(nextSnapshot) : width - padding.right;
    const left = Math.max(padding.left, previousSnapshot ? (previousX + x) / 2 : x - 12);
    const right = Math.min(width - padding.right, nextSnapshot ? (x + nextX) / 2 : x + 12);
    const top5Year = point.top5YearTurnover ?? 0;
    const weightedYear = point.weightedYearTurnover ?? 0;
    const isRegime =
      top5Year >= TOP5_TURNOVER_REGIME_THRESHOLD ||
      (weightedRegimeThreshold !== null && weightedYear >= weightedRegimeThreshold);
    const isWatch =
      isRegime ||
      top5Year >= TOP5_TURNOVER_WATCH_THRESHOLD ||
      (weightedWatchThreshold !== null && weightedYear >= weightedWatchThreshold);

    if (!isWatch) return [];

    return [{
      date: point.snapshot.asOfDate,
      left,
      width: Math.max(2, right - left),
      isRegime,
    }];
  });

  const yForValue = (value: number) =>
    height -
    padding.bottom -
    value * (height - padding.top - padding.bottom);
  const series = [
    {
      key: "top5Quarter",
      label: "Top5 vs prev quarter",
      color: "#0057ff",
      dash: "",
      getValue: (point: (typeof turnoverPoints)[number]) =>
        point.top5QuarterTurnover,
    },
    {
      key: "weightedQuarter",
      label: "Top10 weighted vs prev quarter",
      color: "#d0003b",
      dash: "",
      getValue: (point: (typeof turnoverPoints)[number]) =>
        point.weightedQuarterTurnover,
    },
    {
      key: "top5Year",
      label: "Top5 vs same quarter last year",
      color: "#008b8b",
      dash: "5 4",
      getValue: (point: (typeof turnoverPoints)[number]) =>
        point.top5YearTurnover,
    },
    {
      key: "weightedYear",
      label: "Top10 weighted vs same quarter last year",
      color: "#ff6b00",
      dash: "5 4",
      getValue: (point: (typeof turnoverPoints)[number]) =>
        point.weightedYearTurnover,
    },
  ];
  const yTicks = [1, 0.75, 0.5, 0.25, 0];

  return (
    <div className="border-t border-zinc-200 bg-white px-5 py-4">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            core identity turnover
          </div>
          <h2 className="mt-2 text-base font-semibold text-zinc-950">
            How much the market core identity changed from the prior quarter and prior year
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-600">
            Solid lines compare against the previous quarter. Dashed lines compare
            against the same quarter one year earlier. Top5 is a direct set
            change; Top10 weighted uses signal shares to reduce cutoff noise.
          </p>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
          high values mark candidate identity shifts
        </div>
      </div>

      <div ref={containerRef} className="overflow-x-auto border border-zinc-200">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label="Market core identity turnover timeline"
          className="bg-white"
        >
          <line
            x1={padding.left}
            y1={height - padding.bottom}
            x2={width - padding.right}
            y2={height - padding.bottom}
            stroke="#d4d4d8"
          />
          <line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left}
            y2={height - padding.bottom}
            stroke="#d4d4d8"
          />
          {regimeBands.map((band) => (
            <rect
              key={`regime-band-${band.date}`}
              x={band.left}
              y={padding.top}
              width={band.width}
              height={height - padding.top - padding.bottom}
              fill={band.isRegime ? "#71717a" : "#a1a1aa"}
              opacity={band.isRegime ? 0.16 : 0.08}
              stroke={band.isRegime ? "#71717a" : "none"}
              strokeDasharray={band.isRegime ? "4 4" : undefined}
            />
          ))}
          {yTicks.map((value) => {
            const y = yForValue(value);

            return (
              <g key={value}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="#f1f1f2"
                />
                <text
                  x={padding.left - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-zinc-500 font-mono text-[10px]"
                >
                  {value.toFixed(2)}
                </text>
              </g>
            );
          })}
          {[
            TOP5_TURNOVER_WATCH_THRESHOLD,
            TOP5_TURNOVER_REGIME_THRESHOLD,
          ].map((value) => {
            const y = yForValue(value);
            const isRegime = value === TOP5_TURNOVER_REGIME_THRESHOLD;

            return (
              <g key={`identity-threshold-${value}`}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke={isRegime ? "#71717a" : "#a1a1aa"}
                  strokeDasharray={isRegime ? "5 4" : "2 5"}
                  strokeWidth={1.2}
                />
                <text
                  x={padding.left + 8}
                  y={y - 4}
                  className="fill-zinc-500 font-mono text-[9px]"
                >
                  {isRegime ? "regime 0.75" : "watch 0.57"}
                </text>
              </g>
            );
          })}
          {snapshots.map((snapshot, index) => {
            const x = xForSnapshot(snapshot);
            const selected = snapshot.asOfDate === selectedDate;
            const label = timelineYearTickLabel(snapshot, index, snapshots);

            return (
              <g
                key={`turnover-axis-${snapshot.asOfDate}`}
                className="cursor-pointer"
                onClick={() => onSelect(snapshot.asOfDate)}
              >
                <line
                  x1={x}
                  y1={padding.top}
                  x2={x}
                  y2={height - padding.bottom + 8}
                  stroke={selected ? "#b88a2f" : "#f1f1f2"}
                  strokeWidth={selected ? 2 : 1}
                />
                <line
                  x1={x}
                  y1={height - padding.bottom}
                  x2={x}
                  y2={height - padding.bottom + (label ? 10 : 5)}
                  stroke={selected ? "#b88a2f" : label ? "#a1a1aa" : "#d4d4d8"}
                  strokeWidth={selected || label ? 1.5 : 1}
                />
                <text
                  x={x}
                  y={height - 18}
                  textAnchor="middle"
                  className={
                    label
                      ? "fill-zinc-500 font-mono text-[10px]"
                      : "fill-transparent font-mono text-[8px]"
                  }
                >
                  {label ?? ""}
                </text>
              </g>
            );
          })}
          {series.map((item) => {
            const points = turnoverPoints.flatMap((point) => {
              const value = item.getValue(point);
              if (value === null) return [];

              return [{
                ...point,
                value,
                x: xForSnapshot(point.snapshot),
                y: yForValue(value),
              }];
            });
            const path = points
              .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
              .join(" ");

            return (
              <g key={item.key}>
                <path
                  d={path}
                  fill="none"
                  stroke={item.color}
                  strokeDasharray={item.dash}
                  strokeWidth={2.4}
                />
                {points.map((point) => {
                  const selected = point.snapshot.asOfDate === selectedDate;

                  return (
                    <g
                      key={`${item.key}-${point.snapshot.asOfDate}`}
                      className="cursor-pointer"
                      onClick={() => onSelect(point.snapshot.asOfDate)}
                    >
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r={selected ? 5 : 3.5}
                        fill={selected ? "#b88a2f" : item.color}
                        stroke="#fff"
                        strokeWidth={2}
                      />
                    </g>
                  );
                })}
              </g>
            );
          })}
          {series.map((item, index) => (
            <g key={`turnover-legend-${item.key}`}>
              <line
                x1={width - padding.right - 250}
                y1={14 + index * 16}
                x2={width - padding.right - 228}
                y2={14 + index * 16}
                stroke={item.color}
                strokeDasharray={item.dash}
                strokeWidth={2.5}
              />
              <text
                x={width - padding.right - 220}
                y={18 + index * 16}
                className="fill-zinc-500 font-mono text-[10px]"
              >
              {item.label}
            </text>
            </g>
          ))}
          <g>
            <rect
              x={width - padding.right - 250}
              y={height - 27}
              width={22}
              height={10}
              fill="#71717a"
              opacity={0.16}
              stroke="#71717a"
              strokeDasharray="4 4"
            />
            <text
              x={width - padding.right - 220}
              y={height - 18}
              className="fill-zinc-500 font-mono text-[10px]"
            >
              regime-change candidate
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
}

function CoreIdentityFlow({
  snapshots,
  selectedDate,
  onSelect,
  axisScope,
  split,
  title,
  subtitle,
}: {
  snapshots: TickerSignalCombinationTimelineSnapshot[];
  selectedDate: string;
  onSelect: (date: string) => void;
  axisScope: SignalTimelineAxisScope;
  split: "first" | "peak";
  title: string;
  subtitle: string;
}) {
  const [containerRef, containerWidth] = useElementWidth<HTMLDivElement>();
  const laneLabelWidth = 250;
  const topPadding = 42;
  const laneHeight = 44;
  const bottomPadding = 40;
  const width = Math.max(
    1040,
    containerWidth,
    laneLabelWidth + timelineYearSpan(snapshots) * 48 + 56,
  );
  const plotWidth = width - laneLabelWidth - 32;
  const xForSnapshot = buildTimelineXScale({
    snapshots,
    left: laneLabelWidth,
    right: laneLabelWidth + plotWidth,
  });
  const signalOrder = new Map<string, {
    firstSeen: number;
    maxShare: number;
    axis: string;
    axisLabel: string;
    signalLabel: string;
  }>();

  snapshots.forEach((snapshot, snapshotIndex) => {
    const view = getSplitView(snapshot, split);

    view?.baselineSignals.slice(0, 5).forEach((signal) => {
      const current = signalOrder.get(signal.signal.token);
      if (!current) {
        signalOrder.set(signal.signal.token, {
          firstSeen: snapshotIndex,
          maxShare: signal.share,
          axis: signal.signal.axis,
          axisLabel: getAxisDisplayLabel(signal.signal),
          signalLabel: getSignalDisplayLabel(signal.signal),
        });
        return;
      }

      current.maxShare = Math.max(current.maxShare, signal.share);
    });
  });

  const lanes = [...signalOrder.entries()]
    .sort(
      ([leftToken, left], [rightToken, right]) =>
        getAxisOrder(left.axis) - getAxisOrder(right.axis) ||
        left.axisLabel.localeCompare(right.axisLabel) ||
        left.firstSeen - right.firstSeen ||
        right.maxShare - left.maxShare ||
        leftToken.localeCompare(rightToken),
    )
    .slice(0, 12);
  const height = topPadding + lanes.length * laneHeight + bottomPadding;
  const shareBySnapshotAndToken = new Map<string, number>();

  snapshots.forEach((snapshot) => {
    const view = getSplitView(snapshot, split);

    view?.baselineSignals.slice(0, 5).forEach((signal) => {
      shareBySnapshotAndToken.set(
        `${snapshot.asOfDate}:${signal.signal.token}`,
        signal.share,
      );
    });
  });

  return (
    <div className="bg-[#fbfaf5] p-5">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            market core identity flow
          </div>
          <h2 className="mt-2 text-base font-semibold text-zinc-950">
            {title}
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-600">
            {subtitle}
          </p>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
          click a year to inspect
        </div>
      </div>

      <div ref={containerRef} className="overflow-x-auto">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label="Market core baseline signal flow by year"
          className="min-w-max bg-white"
        >
          {snapshots.map((snapshot, index) => {
            const x = xForSnapshot(snapshot);
            const selected = snapshot.asOfDate === selectedDate;
            const label = timelineYearTickLabel(snapshot, index, snapshots);

            return (
              <g
                key={`year-${snapshot.asOfDate}`}
                className="cursor-pointer"
                onClick={() => onSelect(snapshot.asOfDate)}
              >
                <line
                  x1={x}
                  y1={topPadding - 18}
                  x2={x}
                  y2={height - bottomPadding + 8}
                  stroke={selected ? "#b88a2f" : "#e4e4e7"}
                  strokeWidth={selected ? 2 : 1}
                />
                <line
                  x1={x}
                  y1={topPadding - 18}
                  x2={x}
                  y2={topPadding - (label ? 6 : 11)}
                  stroke={selected ? "#b88a2f" : label ? "#a1a1aa" : "#d4d4d8"}
                  strokeWidth={selected || label ? 1.5 : 1}
                />
                <text
                  x={x}
                  y={18}
                  textAnchor="middle"
                  className={
                    label
                      ? "fill-zinc-500 font-mono text-[10px]"
                      : "fill-transparent font-mono text-[8px]"
                  }
                >
                  {label ?? ""}
                </text>
                <text
                  x={x}
                  y={height - 15}
                  textAnchor="middle"
                  className="fill-zinc-400 font-mono text-[9px]"
                >
                  {snapshot.analysis?.largestBeforeSize ?? "-"}
                </text>
              </g>
            );
          })}

          {lanes.map(([token, lane], laneIndex) => {
            const y = topPadding + laneIndex * laneHeight;
            const color =
              axisScope === "all"
                ? colorForSignalAxis({ axis: lane.axis, token })
                : colorForSignalToken(token);
            const activePoints = snapshots.flatMap((snapshot, snapshotIndex) => {
              const share = shareBySnapshotAndToken.get(`${snapshot.asOfDate}:${token}`);
              if (share === undefined) return [];

              return [{
                x: xForSnapshot(snapshot),
                y,
                share,
                snapshot,
              }];
            });
            const segments = activePoints.flatMap((point, index) => {
              const next = activePoints[index + 1];
              if (!next) return [];
              const currentIndex = snapshots.findIndex(
                (snapshot) => snapshot.asOfDate === point.snapshot.asOfDate,
              );
              const nextIndex = snapshots.findIndex(
                (snapshot) => snapshot.asOfDate === next.snapshot.asOfDate,
              );
              if (nextIndex - currentIndex !== 1) return [];
              return [{ from: point, to: next }];
            });

            return (
              <g key={token}>
                <text
                  x={0}
                  y={y}
                  className="text-[11px] font-semibold"
                  fill={color}
                >
                  {lane.signalLabel}
                </text>
                <text
                  x={0}
                  y={y + 14}
                  className="font-mono text-[9px] uppercase"
                  fill={color}
                  opacity={0.82}
                >
                  {lane.axisLabel}
                </text>
                <text
                  x={0}
                  y={y + 28}
                  className="fill-zinc-400 font-mono text-[9px]"
                >
                  max {formatPercent(lane.maxShare)}
                </text>
                <line
                  x1={laneLabelWidth}
                  y1={y}
                  x2={width - 24}
                  y2={y}
                  stroke="#f1f1f2"
                  strokeWidth={1}
                />
                {segments.map((segment) => (
                  <line
                    key={`${segment.from.snapshot.asOfDate}-${segment.to.snapshot.asOfDate}-${token}`}
                    x1={segment.from.x}
                    y1={segment.from.y}
                    x2={segment.to.x}
                    y2={segment.to.y}
                    stroke={color}
                    strokeWidth={3}
                    opacity={0.7}
                  />
                ))}
                {activePoints.map((point) => (
                  <g
                    key={`${point.snapshot.asOfDate}-${token}`}
                    className="cursor-pointer"
                    onClick={() => onSelect(point.snapshot.asOfDate)}
                  >
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={Math.max(4, Math.min(10, point.share * 11))}
                      fill={color}
                      opacity={point.snapshot.asOfDate === selectedDate ? 1 : 0.78}
                      stroke={
                        point.snapshot.asOfDate === selectedDate ? "#18181b" : "#fff"
                      }
                      strokeWidth={2}
                    />
                    <text
                      x={point.x}
                      y={point.y - 9}
                      textAnchor="middle"
                      className="fill-zinc-500 font-mono text-[8px]"
                    >
                      {Math.round(point.share * 100)}
                    </text>
                  </g>
                ))}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function SignalBars({
  title,
  subtitle,
  signals,
  tone,
}: {
  title: string;
  subtitle: string;
  signals: Array<
    TickerSignalCombinationFamilySignalSummary | {
      signal: TickerSignalCombinationFamilySignalSummary["signal"];
      share: number;
      lift?: number | null;
      baselineShare?: number;
      edgeCount?: number;
    }
  >;
  tone: "baseline" | "boundary" | "piece";
}) {
  const color =
    tone === "baseline" ? "#173b35" : tone === "boundary" ? "#8a4b24" : "#334155";

  return (
    <div className="border border-zinc-200 bg-white p-4">
      <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
        {title}
      </div>
      <p className="mt-1 text-xs leading-5 text-zinc-500">{subtitle}</p>
      <div className="mt-4 grid gap-3">
        {signals.length === 0 ? (
          <div className="text-sm text-zinc-500">No signal summary.</div>
        ) : (
          signals.slice(0, 5).map((item) => (
            <div key={item.signal.token}>
              <div className="flex items-start justify-between gap-3 text-xs">
                <SignalDisplayName signal={item.signal} />
                <span className="shrink-0 font-mono text-[11px] text-zinc-600">
                  {formatPercent(item.share)}
                </span>
              </div>
              <div className="mt-1 h-1.5 border border-zinc-300 bg-[#f2f3ef]">
                <div
                  className="h-full"
                  style={{
                    width: `${Math.max(3, item.share * 100)}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
              {"lift" in item || "edgeCount" in item ? (
                <div className="mt-1 font-mono text-[10px] text-zinc-500">
                  {"edgeCount" in item && item.edgeCount !== undefined
                    ? `${item.edgeCount} boundary edges · `
                    : ""}
                  {"baselineShare" in item && item.baselineShare !== undefined
                    ? `baseline ${formatPercent(item.baselineShare)} · `
                    : ""}
                  {"lift" in item ? `lift ${formatRatio(item.lift)}` : ""}
                </div>
              ) : (
                <div className="mt-1 font-mono text-[10px] text-zinc-500">
                  {item.signal.token}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SplitAnalysisCards({
  analyses,
}: {
  analyses: TickerSignalCombinationTimelineAnalysis[];
}) {
  if (analyses.length === 0) return null;

  return (
    <div className="grid gap-2 lg:grid-cols-2">
      {analyses.map((analysis) => (
        <div key={analysis.label} className="border border-zinc-200 bg-white p-3">
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            {analysis.label.includes("first largest")
              ? "First largest split"
              : "Peak fragmentation split"}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div>
              <div className="font-mono font-semibold text-zinc-950">
                {analysis.previousThreshold.toFixed(2)} →{" "}
                {analysis.peakThreshold.toFixed(2)}
              </div>
              <div className="text-zinc-500">threshold</div>
            </div>
            <div>
              <div className="font-mono font-semibold text-zinc-950">
                {analysis.peakMoment.toFixed(1)}
              </div>
              <div className="text-zinc-500">second moment</div>
            </div>
            <div>
              <div className="font-mono font-semibold text-zinc-950">
                {analysis.largestBeforeSize} → {analysis.largestAfterSize}
              </div>
              <div className="text-zinc-500">largest component</div>
            </div>
            <div>
              <div className="font-mono font-semibold text-zinc-950">
                {analysis.bridgeEdgeCount}
              </div>
              <div className="text-zinc-500">boundary edges</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SnapshotDetail({
  snapshot,
}: {
  snapshot: TickerSignalCombinationTimelineSnapshot;
}) {
  const analysis: TickerSignalCombinationTimelineAnalysis | null =
    snapshot.analysis;

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            {snapshot.label} · {snapshot.asOfDate}
          </div>
          <h2 className="mt-1 text-base font-semibold text-zinc-950">
            Boundary connecting signals
          </h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500">
            Signals shared by cross-piece edges that disappear at the
            second-moment split.
          </p>
        </div>
        {analysis ? (
          <div className="font-mono text-[11px] text-zinc-500">
            threshold {analysis.previousThreshold.toFixed(2)} →{" "}
            {analysis.peakThreshold.toFixed(2)} ·{" "}
            {analysis.bridgeEdgeCount} boundary edges
          </div>
        ) : null}
      </div>

      <SignalBars
        title="boundary signals"
        subtitle="Only the removed cross-piece edges are counted here."
        signals={snapshot.boundarySignals}
        tone="boundary"
      />
    </div>
  );
}

function ForwardReturnValidationPanel({
  result,
  candidateBand,
  isLoading,
  errorMessage,
  copyNotice,
  onCopyCurrent,
  onDownloadCurrent,
}: {
  result: SignalCoreForwardReturns | null;
  candidateBand: string;
  isLoading: boolean;
  errorMessage: string | null;
  copyNotice: string | null;
  onCopyCurrent: () => void;
  onDownloadCurrent: () => void;
}) {
  return (
    <WorkstationPanel className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-zinc-200 px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            forward return validation
          </div>
          <h2 className="mt-2 text-base font-semibold text-zinc-950">
            Pre-break core ticker returns after the selected split
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-600">
            The core is the largest component immediately before the percolation
            split. Cached returns are shown for the selected snapshot when
            available, whether or not it is a validation event.
          </p>
        </div>
        <div className="relative flex flex-wrap items-center gap-2 pt-5 lg:justify-end lg:pt-0">
          {copyNotice ? (
            <span className="absolute right-0 top-0 text-xs text-zinc-500">
              {copyNotice}
            </span>
          ) : null}
          <button
            type="button"
            onClick={onCopyCurrent}
            disabled={!result || isLoading}
            className="border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-[#fbfaf5] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Copy Current
          </button>
          <button
            type="button"
            onClick={onDownloadCurrent}
            disabled={!result || isLoading}
            className="border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-[#fbfaf5] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Download Current
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-5 text-sm text-zinc-600">
          Loading forward return validation...
        </div>
      ) : errorMessage ? (
        <div className="p-5 text-sm text-red-700">{errorMessage}</div>
      ) : result ? (
        <div className="grid gap-4 p-4 lg:grid-cols-[280px_1fr]">
          <div className="border border-zinc-200 bg-[#fbfaf5] p-4">
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-zinc-500">
              selected snapshot
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-zinc-500">Date</div>
                <div className="mt-1 font-medium text-zinc-950">
                  {result.asOfDate}
                </div>
              </div>
              <div>
                <div className="text-xs text-zinc-500">Split</div>
                <div className="mt-1 font-medium text-zinc-950">
                  {result.previousThreshold.toFixed(2)} →{" "}
                  {result.peakThreshold.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-xs text-zinc-500">Core nodes</div>
                <div className="mt-1 font-medium text-zinc-950">
                  {formatNumber(result.coreGroupCount)}
                </div>
              </div>
              <div>
                <div className="text-xs text-zinc-500">Core tickers</div>
                <div className="mt-1 font-medium text-zinc-950">
                  {formatNumber(result.coreTickerCount)}
                </div>
              </div>
              <div className="col-span-2">
                <div className="text-xs text-zinc-500">Candidate band</div>
                <div className="mt-1 font-medium text-zinc-950">
                  {candidateBand}
                </div>
              </div>
            </div>
            <div className="mt-3 border-t border-zinc-200 pt-3 text-xs leading-5 text-zinc-500">
              {result.provider} / {result.adjustmentPolicy}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                  <th className="border-b border-zinc-200 px-3 py-2 font-semibold">
                    Window
                  </th>
                  <th className="border-b border-zinc-200 px-3 py-2 font-semibold">
                    Target date
                  </th>
                  <th className="border-b border-zinc-200 px-3 py-2 text-right font-semibold">
                    Observed
                  </th>
                  <th className="border-b border-zinc-200 px-3 py-2 text-right font-semibold">
                    Mean
                  </th>
                  <th className="border-b border-zinc-200 px-3 py-2 text-right font-semibold">
                    Median
                  </th>
                  <th className="border-b border-zinc-200 px-3 py-2 text-right font-semibold">
                    SPY
                  </th>
                  <th className="border-b border-zinc-200 px-3 py-2 text-right font-semibold">
                    QQQ
                  </th>
                  <th className="border-b border-zinc-200 px-3 py-2 text-right font-semibold">
                    DIA
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.summaries.map((summary) => {
                  const benchmarkByTicker = new Map(
                    result.benchmarkSummaries
                      .filter((item) => item.window === summary.window)
                      .map((item) => [item.ticker, item]),
                  );

                  return (
                    <tr key={summary.window} className="text-zinc-700">
                      <td className="border-b border-zinc-100 px-3 py-3 font-medium text-zinc-950">
                        +{summary.window}
                      </td>
                      <td className="border-b border-zinc-100 px-3 py-3">
                        {summary.targetDate || "-"}
                      </td>
                      <td className="border-b border-zinc-100 px-3 py-3 text-right">
                        {formatObservedCount(summary)}
                      </td>
                      <td className="border-b border-zinc-100 px-3 py-3 text-right font-medium">
                        {formatSignedPercent(summary.meanReturn)}
                      </td>
                      <td className="border-b border-zinc-100 px-3 py-3 text-right font-medium">
                        {formatSignedPercent(summary.medianReturn)}
                      </td>
                      <td className="border-b border-zinc-100 px-3 py-3 text-right">
                        {formatSignedPercent(benchmarkByTicker.get("SPY")?.return)}
                      </td>
                      <td className="border-b border-zinc-100 px-3 py-3 text-right">
                        {formatSignedPercent(benchmarkByTicker.get("QQQ")?.return)}
                      </td>
                      <td className="border-b border-zinc-100 px-3 py-3 text-right">
                        {formatSignedPercent(benchmarkByTicker.get("DIA")?.return)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-5 overflow-x-auto lg:col-span-2">
            <table className="min-w-[720px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs uppercase text-zinc-500">
                  <th className="whitespace-nowrap border-b border-zinc-200 px-3 py-2 font-semibold">
                    Benchmark
                  </th>
                  <th className="min-w-[240px] border-b border-zinc-200 px-3 py-2 font-semibold">
                    Theme
                  </th>
                  {result.summaries.map((summary) => (
                    <th
                      key={summary.window}
                      className="whitespace-nowrap border-b border-zinc-200 px-3 py-2 text-right font-semibold"
                    >
                      +{summary.window}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {getBenchmarkTickers(result).map((ticker) => {
                  const returnsByWindow = new Map(
                    result.benchmarkSummaries
                      .filter((item) => item.ticker.toUpperCase() === ticker)
                      .map((item) => [item.window, item.return]),
                  );

                  return (
                    <tr key={ticker} className="text-zinc-700">
                      <td className="border-b border-zinc-100 px-3 py-3 font-medium text-zinc-950">
                        {ticker}
                      </td>
                      <td className="border-b border-zinc-100 px-3 py-3 text-zinc-500">
                        {getSignalCoreForwardBenchmarkTheme(ticker)}
                      </td>
                      {result.summaries.map((summary) => (
                        <td
                          key={summary.window}
                          className="border-b border-zinc-100 px-3 py-3 text-right font-medium"
                        >
                          {formatSignedPercent(returnsByWindow.get(summary.window))}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="p-5 text-sm text-zinc-600">
          Select a cached timeline snapshot to view forward returns.
        </div>
      )}
    </WorkstationPanel>
  );
}

function buildCurrentForwardReturnMarkdown(result: SignalCoreForwardReturns) {
  const lines = [
    "# Forward Return Validation",
    "",
    `- Axis scope: \`${result.axisScope}\``,
    `- Snapshot date: ${result.asOfDate}`,
    `- Split: ${result.previousThreshold.toFixed(2)} -> ${result.peakThreshold.toFixed(2)}`,
    `- Core nodes: ${result.coreGroupCount}`,
    `- Core tickers: ${result.coreTickerCount}`,
    `- Price source: ${result.provider} / ${result.adjustmentPolicy}`,
    `- Benchmarks: ${result.benchmarkTickers.join(", ")}`,
    "",
    "| Window | Target Date | Observed | Mean Return | Median Return | SPY | QQQ | DIA |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];

  for (const summary of result.summaries) {
    const benchmarkByTicker = new Map(
      result.benchmarkSummaries
        .filter((item) => item.window === summary.window)
        .map((item) => [item.ticker, item]),
    );

    lines.push(
      `| ${[
        `+${summary.window}`,
        summary.targetDate || "-",
        summary.observedCount,
        formatSignedPercent(summary.meanReturn),
        formatSignedPercent(summary.medianReturn),
        formatSignedPercent(benchmarkByTicker.get("SPY")?.return),
        formatSignedPercent(benchmarkByTicker.get("QQQ")?.return),
        formatSignedPercent(benchmarkByTicker.get("DIA")?.return),
      ].join(" | ")} |`,
    );
  }

  lines.push(
    "",
    "## Benchmark Returns",
    "",
    "| Ticker | Theme | +1M | +3M | +6M | +12M |",
    "| --- | --- | ---: | ---: | ---: | ---: |",
  );

  for (const ticker of getBenchmarkTickers(result)) {
    const returnsByWindow = new Map(
      result.benchmarkSummaries
        .filter((summary) => summary.ticker.toUpperCase() === ticker)
        .map((summary) => [summary.window, summary.return]),
    );

    lines.push(
      `| ${[
        ticker,
        getSignalCoreForwardBenchmarkTheme(ticker),
        formatSignedPercent(returnsByWindow.get("1M")),
        formatSignedPercent(returnsByWindow.get("3M")),
        formatSignedPercent(returnsByWindow.get("6M")),
        formatSignedPercent(returnsByWindow.get("12M")),
      ].join(" | ")} |`,
    );
  }

  lines.push("");

  return lines.join("\n");
}

async function loadCandidateForwardValidations(input: {
  overview: TickerSignalCombinationTimelineOverview;
  axisScope: SignalTimelineAxisScope;
}): Promise<SignalTimelineForwardValidation[]> {
  const candidates = getCandidateForwardValidationDates(input.overview).map(
    (asOfDate) => {
      const snapshot = input.overview.snapshots.find(
        (item) => item.asOfDate === asOfDate,
      );

      return snapshot
        ? {
            snapshot,
            candidateBand: getForwardValidationCandidateBand(
              input.overview,
              snapshot,
            ),
          }
        : null;
    },
  ).filter(
    (candidate): candidate is {
      snapshot: TickerSignalCombinationTimelineSnapshot;
      candidateBand: string;
    } => candidate !== null && candidate.candidateBand !== "-",
  );
  const cached = await fetchCachedSignalCoreForwardReturns({
    axisScope: input.axisScope,
    asOfDates: candidates.map((candidate) => candidate.snapshot.asOfDate),
  });
  const candidateBandsByDate = new Map(
    candidates.map((candidate) => [
      candidate.snapshot.asOfDate,
      {
        label: candidate.snapshot.label,
        candidateBand: candidate.candidateBand,
      },
    ]),
  );

  return cached.results.map((result) => {
    const candidate = candidateBandsByDate.get(result.asOfDate);

    return {
      asOfDate: result.asOfDate,
      label: candidate?.label ?? result.asOfDate,
      candidateBand: candidate?.candidateBand ?? "cached",
      previousThreshold: result.previousThreshold,
      peakThreshold: result.peakThreshold,
      coreGroupCount: result.coreGroupCount,
      coreTickerCount: result.coreTickerCount,
      summaries: result.summaries,
      benchmarkTickers: result.benchmarkTickers,
      benchmarkSummaries: result.benchmarkSummaries,
    };
  });
}

async function loadCachedForwardValidations(input: {
  overview: TickerSignalCombinationTimelineOverview;
  axisScope: SignalTimelineAxisScope;
}): Promise<SignalTimelineForwardValidation[]> {
  const snapshots = input.overview.snapshots.filter(
    (snapshot) => snapshot.analysis !== null,
  );
  const cached = await fetchCachedSignalCoreForwardReturns({
    axisScope: input.axisScope,
    asOfDates: snapshots.map((snapshot) => snapshot.asOfDate),
  });
  const snapshotsByDate = new Map(
    snapshots.map((snapshot) => [snapshot.asOfDate, snapshot]),
  );

  return cached.results.map((result) => {
    const snapshot = snapshotsByDate.get(result.asOfDate);

    return {
      asOfDate: result.asOfDate,
      label: snapshot?.label ?? result.asOfDate,
      candidateBand: snapshot
        ? getForwardValidationCandidateBand(input.overview, snapshot)
        : "-",
      previousThreshold: result.previousThreshold,
      peakThreshold: result.peakThreshold,
      coreGroupCount: result.coreGroupCount,
      coreTickerCount: result.coreTickerCount,
      summaries: result.summaries,
      benchmarkTickers: result.benchmarkTickers,
      benchmarkSummaries: result.benchmarkSummaries,
    };
  });
}

function getCandidateForwardValidationDates(
  overview: TickerSignalCombinationTimelineOverview,
) {
  const snapshotsByDate = new Map(
    overview.snapshots.map((snapshot) => [snapshot.asOfDate, snapshot]),
  );
  const turnoverRows = overview.snapshots.flatMap((snapshot, index) => {
    const previousQuarter = overview.snapshots[index - 1] ?? null;
    const previousYearQuarter =
      snapshotsByDate.get(previousYearSameQuarterDate(snapshot.asOfDate)) ?? null;
    const quarterTurnover = previousQuarter
      ? calculateCoreIdentityTurnover(previousQuarter, snapshot)
      : null;
    const yearTurnover = previousYearQuarter
      ? calculateCoreIdentityTurnover(previousYearQuarter, snapshot)
      : null;

    if (!quarterTurnover && !yearTurnover) return [];

    return [
      {
        snapshot,
        top5YearTurnover: yearTurnover?.top5Turnover ?? null,
        weightedYearTurnover: yearTurnover?.weightedTop10Turnover ?? null,
      },
    ];
  });
  const weightedYearValues = turnoverRows
    .map((row) => row.weightedYearTurnover)
    .filter((value): value is number => value !== null);
  const weightedWatchThreshold = percentile(weightedYearValues, 0.8);
  const weightedRegimeThreshold = percentile(weightedYearValues, 0.9);
  return turnoverRows.flatMap((row) => {
    const top5Year = row.top5YearTurnover ?? 0;
    const weightedYear = row.weightedYearTurnover ?? 0;
    const isRegime =
      top5Year >= TOP5_TURNOVER_REGIME_THRESHOLD ||
      (weightedRegimeThreshold !== null && weightedYear >= weightedRegimeThreshold);
    const isWatch =
      isRegime ||
      top5Year >= TOP5_TURNOVER_WATCH_THRESHOLD ||
      (weightedWatchThreshold !== null && weightedYear >= weightedWatchThreshold);

    if (!isWatch) return [];

    return [row.snapshot.asOfDate];
  });
}

function getForwardValidationCandidateBand(
  overview: TickerSignalCombinationTimelineOverview,
  snapshot: TickerSignalCombinationTimelineSnapshot,
) {
  const snapshotsByDate = new Map(
    overview.snapshots.map((item) => [item.asOfDate, item]),
  );
  const weightedYearValues = overview.snapshots
    .map((item) => {
      const previousYearQuarter = snapshotsByDate.get(
        previousYearSameQuarterDate(item.asOfDate),
      );
      const turnover = previousYearQuarter
        ? calculateCoreIdentityTurnover(previousYearQuarter, item)
        : null;

      return turnover?.weightedTop10Turnover ?? null;
    })
    .filter((value): value is number => value !== null);
  const previousYearQuarter = snapshotsByDate.get(
    previousYearSameQuarterDate(snapshot.asOfDate),
  );
  const yearTurnover = previousYearQuarter
    ? calculateCoreIdentityTurnover(previousYearQuarter, snapshot)
    : null;
  const weightedWatchThreshold = percentile(weightedYearValues, 0.8);
  const weightedRegimeThreshold = percentile(weightedYearValues, 0.9);
  const top5Year = yearTurnover?.top5Turnover ?? 0;
  const weightedYear = yearTurnover?.weightedTop10Turnover ?? 0;
  const isRegime =
    top5Year >= TOP5_TURNOVER_REGIME_THRESHOLD ||
    (weightedRegimeThreshold !== null && weightedYear >= weightedRegimeThreshold);
  const isWatch =
    isRegime ||
    top5Year >= TOP5_TURNOVER_WATCH_THRESHOLD ||
    (weightedWatchThreshold !== null && weightedYear >= weightedWatchThreshold);

  return isRegime ? "regime-change candidate" : isWatch ? "watch" : "-";
}

export function MarketSignalTimeline() {
  const [overview, setOverview] =
    useState<TickerSignalCombinationTimelineOverview | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [axisScope, setAxisScope] =
    useState<SignalTimelineAxisScope>("all");
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const [forwardReturns, setForwardReturns] =
    useState<SignalCoreForwardReturns | null>(null);
  const [forwardReturnsLoading, setForwardReturnsLoading] = useState(false);
  const [forwardReturnsError, setForwardReturnsError] = useState<string | null>(
    null,
  );
  const [markdownBusy, setMarkdownBusy] = useState(false);
  const [currentForwardNotice, setCurrentForwardNotice] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let isMounted = true;

    fetchSignalCombinationTimeline({
      includeLatest: true,
      axisScope,
    })
      .then((nextOverview) => {
        if (!isMounted) return;
        setOverview(nextOverview);
        setSelectedDate(nextOverview.snapshots.at(-1)?.asOfDate ?? null);
        setErrorMessage(null);
      })
      .catch((error) => {
        if (!isMounted) return;
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to fetch signal timeline.",
        );
      });

    return () => {
      isMounted = false;
    };
  }, [axisScope]);

  const selectedSnapshot = useMemo(() => {
    if (!overview) return null;
    return (
      overview.snapshots.find((snapshot) => snapshot.asOfDate === selectedDate) ??
      overview.snapshots.at(-1) ??
      null
    );
  }, [overview, selectedDate]);
  const selectedScopeOption =
    SIGNAL_TIMELINE_AXIS_SCOPE_OPTIONS.find((option) => option.key === axisScope) ??
    SIGNAL_TIMELINE_AXIS_SCOPE_OPTIONS[0];
  const canExportMarkdown = Boolean(overview && overview.snapshots.length > 0);
  const selectedCandidateBand =
    overview && selectedSnapshot
      ? getForwardValidationCandidateBand(overview, selectedSnapshot)
      : "-";

  useEffect(() => {
    if (!overview || !selectedSnapshot) {
      setForwardReturns(null);
      setForwardReturnsError(null);
      setForwardReturnsLoading(false);
      return;
    }

    let isMounted = true;

    setForwardReturnsLoading(true);
    setForwardReturnsError(null);

    fetchCachedSignalCoreForwardReturns({
      asOfDates: [selectedSnapshot.asOfDate],
      axisScope,
    })
      .then((result) => {
        if (!isMounted) return;
        const selectedResult = result.results[0] ?? null;

        setForwardReturns(selectedResult);
        setForwardReturnsError(
          selectedResult === null
            ? "Forward returns are not cached for this snapshot yet. Run the signal percolation timeline job for this axis lens."
            : null,
        );
      })
      .catch((error) => {
        if (!isMounted) return;
        setForwardReturns(null);
        setForwardReturnsError(
          error instanceof Error
            ? error.message
            : "Failed to fetch forward returns.",
        );
      })
      .finally(() => {
        if (!isMounted) return;
        setForwardReturnsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [axisScope, overview, selectedSnapshot]);

  async function getMarkdownWithForwardValidation(mode: "compact" | "full") {
    if (!overview) return;
    const [forwardValidations, forwardCohortValidations] = await Promise.all([
      loadCandidateForwardValidations({
        overview,
        axisScope,
      }),
      mode === "full"
        ? loadCachedForwardValidations({
            overview,
            axisScope,
          })
        : Promise.resolve([]),
    ]);

    return buildSignalTimelineMarkdown({
      overview,
      selectedSnapshot,
      scopeOption: selectedScopeOption,
      forwardValidations,
      forwardCohortValidations,
      mode,
    });
  }

  async function exportMarkdown() {
    setMarkdownBusy(true);

    try {
      const markdown = await getMarkdownWithForwardValidation("full");
      if (!markdown) return;

      downloadMarkdownFile({
        filename: `signal-network-timeline-${axisScope}-${selectedSnapshot?.asOfDate ?? "latest"}.md`,
        markdown,
      });
    } finally {
      setMarkdownBusy(false);
    }
  }

  async function copyMarkdown() {
    setMarkdownBusy(true);

    try {
      const markdown = await getMarkdownWithForwardValidation("compact");
      if (!markdown) return;

      const copied = await copyTextToClipboard(markdown);
      setCopyNotice(copied ? "Markdown copied." : "Failed to copy Markdown.");
    } catch {
      setCopyNotice("Failed to copy Markdown.");
    } finally {
      setMarkdownBusy(false);
    }

    window.setTimeout(() => {
      setCopyNotice(null);
    }, 2500);
  }

  async function copyCurrentForwardReturns() {
    if (!forwardReturns) return;

    try {
      const copied = await copyTextToClipboard(
        buildCurrentForwardReturnMarkdown(forwardReturns),
      );
      setCurrentForwardNotice(
        copied
          ? "Current validation copied."
          : "Failed to copy current validation.",
      );
    } catch {
      setCurrentForwardNotice("Failed to copy current validation.");
    }

    window.setTimeout(() => {
      setCurrentForwardNotice(null);
    }, 2500);
  }

  function downloadCurrentForwardReturns() {
    if (!forwardReturns) return;

    downloadMarkdownFile({
      filename: `signal-forward-validation-${forwardReturns.axisScope}-${forwardReturns.asOfDate}.md`,
      markdown: buildCurrentForwardReturnMarkdown(forwardReturns),
    });
  }

  return (
    <WorkstationFrame
      title="market signal timeline"
      backHref="/market/cluster/overview"
      backLabel="Cluster overview"
      maxWidthClassName="max-w-none"
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            quarter-end percolation history
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-950">
            Signal network split timeline
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
            Quarter-end snapshots plus the latest signal state. The page tracks
            only the second-moment split, the largest component baseline, and
            boundary signal behavior.
          </p>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-amber-700">
            Latest snapshot caveat: SEC-derived axes should be read as available
            through the latest completed reporting cycle, while price-linked
            axes may include newer market data.
          </p>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-zinc-500">
            Current axis lens: {selectedScopeOption.description} Looking back{" "}
            over the data-qualified quarter-end window.
          </p>
        </div>
        <div className="relative flex flex-wrap items-center gap-2 pt-5 sm:justify-end">
          {copyNotice ? (
            <span className="absolute right-0 top-0 text-xs text-zinc-500">
              {copyNotice}
            </span>
          ) : markdownBusy ? (
            <span className="absolute right-0 top-0 text-xs text-zinc-500">
              Preparing MD with validation...
            </span>
          ) : null}
          <button
            type="button"
            onClick={copyMarkdown}
            disabled={!canExportMarkdown || markdownBusy}
            className="border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-[#fbfaf5] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Copy Compact MD
          </button>
          <button
            type="button"
            onClick={exportMarkdown}
            disabled={!canExportMarkdown || markdownBusy}
            className="border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-[#fbfaf5] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Download Full MD
          </button>
          <Link
            href="/market/cluster/overview"
            className="border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-[#fbfaf5]"
          >
            Current overview
          </Link>
        </div>
      </div>

      <WorkstationPanel className="mb-5 overflow-hidden">
        <div className="border-b border-zinc-200 px-5 py-4">
          <div className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            axis lens
          </div>
          <h2 className="mt-2 text-base font-semibold text-zinc-950">
            Rebuild the signal network with different axis combinations
          </h2>
          <p className="mt-1 text-sm leading-6 text-zinc-600">
            Use all five axes for the broad market view, then compare
            fundamentals, fundamentals plus valuation, and price-linked behavior
            to see which signal family is actually carrying the timeline.
          </p>
        </div>
        <div className="grid gap-2 p-3 md:grid-cols-2 xl:grid-cols-4">
          {SIGNAL_TIMELINE_AXIS_SCOPE_OPTIONS.map((option) => {
            const selected = option.key === axisScope;

            return (
              <button
                key={option.key}
                type="button"
                onClick={() => {
                  if (option.key === axisScope) return;
                  setOverview(null);
                  setSelectedDate(null);
                  setErrorMessage(null);
                  setAxisScope(option.key);
                }}
                className={[
                  "border px-3 py-3 text-left transition",
                  selected
                    ? "border-zinc-950 bg-[#173b35] text-white"
                    : "border-zinc-200 bg-white text-zinc-700 hover:bg-[#fbfaf5]",
                ].join(" ")}
              >
                <div className="text-sm font-semibold">{option.label}</div>
                <div
                  className={[
                    "mt-1 text-xs leading-4",
                    selected ? "text-zinc-100" : "text-zinc-500",
                  ].join(" ")}
                >
                  {option.axes?.join(" + ") ?? "all signal axes"}
                </div>
              </button>
            );
          })}
        </div>
      </WorkstationPanel>

      {errorMessage ? (
        <WorkstationPanel className="border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {errorMessage}
        </WorkstationPanel>
      ) : !overview ? (
        <WorkstationPanel className="p-5 text-sm text-zinc-600">
          Loading {selectedScopeOption.label.toLowerCase()} signal timeline...
        </WorkstationPanel>
      ) : overview.snapshots.length === 0 ? (
        <WorkstationPanel className="p-5 text-sm text-zinc-600">
          No signal timeline snapshots are available yet.
        </WorkstationPanel>
      ) : (
        <div className="grid gap-5">
          <WorkstationPanel className="overflow-hidden">
            <div className="border-b border-zinc-200 px-5 py-4">
              <div className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                core size context
              </div>
              <h2 className="mt-2 text-base font-semibold text-zinc-950">
                How large the core was at each split threshold
              </h2>
              <p className="mt-1 text-sm leading-6 text-zinc-600">
                Use this as context for the identity flow above. The chart tracks
                the largest component share at the threshold immediately before
                the peak-fragmentation split point.
              </p>
            </div>
            <div className="p-4">
              <TimelineChart
                snapshots={overview.snapshots}
                selectedDate={selectedSnapshot?.asOfDate ?? ""}
                onSelect={setSelectedDate}
              />
            </div>
            <CoreIdentityTurnoverChart
              snapshots={overview.snapshots}
              selectedDate={selectedSnapshot?.asOfDate ?? ""}
              onSelect={setSelectedDate}
            />
          </WorkstationPanel>

        <ForwardReturnValidationPanel
          result={forwardReturns}
          candidateBand={selectedCandidateBand}
          isLoading={forwardReturnsLoading}
          errorMessage={forwardReturnsError}
          copyNotice={currentForwardNotice}
            onCopyCurrent={copyCurrentForwardReturns}
            onDownloadCurrent={downloadCurrentForwardReturns}
          />

          <WorkstationPanel className="overflow-hidden">
            <CoreIdentityFlow
              snapshots={overview.snapshots}
              selectedDate={selectedSnapshot?.asOfDate ?? ""}
              onSelect={setSelectedDate}
              axisScope={axisScope}
              split="peak"
              title="Peak fragmentation market core identity"
              subtitle="Top baseline signals inside the largest component immediately before the second-moment peak split."
            />
          </WorkstationPanel>

          {selectedSnapshot ? (
            <WorkstationPanel className="overflow-hidden">
              <div className="border-b border-zinc-200 px-5 py-4 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                selected snapshot diagnostics
              </div>
              <div className="p-4">
                <SnapshotDetail snapshot={selectedSnapshot} />
              </div>
            </WorkstationPanel>
          ) : null}
        </div>
      )}
    </WorkstationFrame>
  );
}
