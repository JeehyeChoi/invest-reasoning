"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type {
  TickerSignalCombinationFamilySignalSummary,
  TickerSignalCombinationFamilySummary,
  TickerSignalCombinationOverview,
  TickerSignalCombinationPercolationBridgeAnalysis,
} from "@/shared/market/signalCombinationOverview";
import { fetchSignalCombinationOverview } from "@/features/market/services/fetchSignalCombinationOverview";
import {
  WorkstationFrame,
  WorkstationPanel,
} from "@/features/workstation/components/WorkstationChrome";

function MarketClusterOverviewShell({ children }: { children: ReactNode }) {
  return (
    <WorkstationFrame
      title="market signal overview"
      backHref="/dashboard"
      backLabel="Dashboard"
      maxWidthClassName="max-w-7xl"
    >
      {children}
    </WorkstationFrame>
  );
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value: number | null) {
  return value === null ? "-" : value.toFixed(2);
}

function formatFeatureValue(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}`;
}

function formatRatio(value: number | null | undefined) {
  return value === null || value === undefined ? "-" : `${value.toFixed(2)}x`;
}

function formatSignedPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatPercent(value)}`;
}

function formatMarketCap(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "-";
  if (value >= 1_000_000_000_000) {
    return `$${(value / 1_000_000_000_000).toFixed(1)}T`;
  }
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  return `$${Math.round(value).toLocaleString()}`;
}

function formatAuditFeatureValue(value: number) {
  if (!Number.isFinite(value)) return "-";
  const absoluteValue = Math.abs(value);

  if (absoluteValue >= 1000) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  if (absoluteValue >= 10) return value.toFixed(1);
  if (absoluteValue >= 1) return value.toFixed(2);
  return value.toFixed(3);
}

function formatSignalNarrativeLabel(
  signalSummary: TickerSignalCombinationFamilySignalSummary,
) {
  return (
    signalSummary.signal.signalLabel ??
    signalSummary.signal.signalKey
      .replace(/_/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .toLowerCase()
  );
}

function formatSignalTokenShort(token: string) {
  return token.split(".").slice(-1)[0]?.replace(/_/g, " ") ?? token;
}

function buildBaselineNarrative(
  analysis: TickerSignalCombinationPercolationBridgeAnalysis,
) {
  const topSignals = analysis.preBreakBaselineSignals.slice(0, 3);
  const topSignalText = topSignals
    .map(
      (signal) =>
        `${formatSignalNarrativeLabel(signal)} (${formatPercent(signal.share)})`,
    )
    .join(", ");
  const hasVolatility = analysis.preBreakBaselineSignals.some((signal) =>
    signal.signal.token.includes("elevated_volatility"),
  );
  const hasQualityConcern = analysis.preBreakBaselineSignals.some((signal) =>
    signal.signal.token.includes("quality_concern"),
  );
  const scaleText =
    analysis.largestAfterPieceCount <= 2
      ? "This is the first visible crack, not yet a broad structural break."
      : "This is a broader fragmentation point where the market core starts to split into interpretable pieces.";
  const cautionText =
    hasVolatility && hasQualityConcern
      ? "The mix is defensive, but not calm: elevated volatility and quality concern are still part of the shared backdrop."
      : hasVolatility
        ? "The shared backdrop is defensive, but price behavior is still volatile."
        : hasQualityConcern
          ? "The shared backdrop includes quality support, but quality concern remains widespread."
          : "The shared backdrop is comparatively clean, without an obvious stress signal among the top shared traits.";

  return `${scaleText} The common market baseline is led by ${topSignalText}. ${cautionText}`;
}

function buildBoundaryNarrative(
  analysis: TickerSignalCombinationPercolationBridgeAnalysis,
) {
  const liftedSignals = analysis.topBridgeSignals
    .filter((signal) => (signal.lift ?? 0) >= 1.2)
    .slice(0, 3);

  if (analysis.bridgeEdgeCount <= 2 || liftedSignals.length === 0) {
    return "The boundary evidence is thin here, so this split should be read as a network diagnostic rather than a strong market story.";
  }

  const liftedText = liftedSignals
    .map(
      (signal) =>
        `${formatSignalTokenShort(signal.signal.token)} (${formatRatio(
          signal.lift,
        )})`,
    )
    .join(", ");

  return `The boundary is most associated with ${liftedText}. These are the signals that were over-represented on the cross-piece edges that disappeared at this threshold.`;
}

function buildPieceNarrative(piece: TickerSignalCombinationFamilySummary) {
  const topSignals = piece.topSignals
    .slice(0, 2)
    .map((signal) => formatSignalNarrativeLabel(signal))
    .join(" + ");
  const topSector = piece.marketAudit?.sectorStats[0];
  const topIndustry = piece.marketAudit?.industryStats[0];
  const sp500Overlap = piece.marketAudit?.universeOverlaps.find(
    (overlap) => overlap.universeKey === "sp500",
  );
  const strongestFeature = piece.featureAudit?.topFeatures[0];
  const hammingText =
    piece.hammingAudit?.averageSimilarity === null ||
    piece.hammingAudit?.averageSimilarity === undefined
      ? "Signal-state cohesion is not available."
      : piece.hammingAudit.averageSimilarity >= 0.7
        ? "Signal-state cohesion is high."
        : piece.hammingAudit.averageSimilarity >= 0.5
          ? "Signal-state cohesion is moderate."
          : "Signal-state cohesion is loose.";
  const marketText = topSector
    ? `It leans toward ${topSector.name}${
        topIndustry ? `, especially ${topIndustry.name}` : ""
      }`
    : "Its sector footprint is mixed";
  const universeText = sp500Overlap
    ? ` with ${formatPercent(sp500Overlap.share)} S&P 500 overlap`
    : "";
  const featureText = strongestFeature
    ? ` The strongest feature contrast is ${strongestFeature.featureKey} (${formatFeatureValue(
        strongestFeature.robustDelta ?? 0,
      )} IQR).`
    : "";

  return `${topSignals || "Mixed signal identity"}. ${marketText}${universeText}. ${hammingText}${featureText}`;
}

function ThresholdFamilyChart({
  overview,
  lens,
}: {
  overview: TickerSignalCombinationOverview;
  lens: "jaccard" | "idfWeightedJaccard" | "hamming";
}) {
  const isHamming = lens === "hamming";
  const isIdfWeighted = lens === "idfWeightedJaccard";
  const stats = isHamming
    ? overview.hammingThresholdStats
    : isIdfWeighted
      ? overview.idfWeightedJaccardThresholdStats
    : overview.thresholdStats;
  const title = isHamming
    ? "Hamming threshold sensitivity"
    : isIdfWeighted
      ? "IDF-weighted Jaccard threshold sensitivity"
    : "Jaccard threshold sensitivity";
  const description = isHamming
    ? "Each point connects exact signal groups when their full-state Hamming similarity is at least the threshold. Higher thresholds keep only tighter full-state families."
    : isIdfWeighted
      ? "Each point connects exact signal groups when their capped IDF-weighted active-signal Jaccard similarity is at least the threshold. Common baseline signals count less than rarer differentiating signals."
    : "Each point connects exact signal groups when their active directional Jaccard similarity is at least the threshold. Higher thresholds keep only tighter directional signal families.";
  const width = 720;
  const height = 220;
  const padding = 32;
  const maxComponentSize = Math.max(
    ...stats.map((stat) => stat.largestFamilySize),
    1,
  );
  const maxSecondMoment = Math.max(
    ...stats.map((stat) => stat.finiteClusterSecondMoment),
    1,
  );
  const largestComponentPoints = stats.map((stat) => {
    const x = padding + stat.threshold * (width - padding * 2);
    const y =
      height -
      padding -
      (stat.largestFamilySize / maxComponentSize) * (height - padding * 2);

    return { ...stat, x, y };
  });
  const secondMomentPoints = stats.map((stat) => {
    const x = padding + stat.threshold * (width - padding * 2);
    const y =
      height -
      padding -
      (stat.finiteClusterSecondMoment / maxSecondMoment) *
        (height - padding * 2);

    return { ...stat, x, y };
  });
  const largestComponentPath = largestComponentPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const secondMomentPath = secondMomentPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const secondMomentPeak = [...stats].sort(
    (a, b) => b.finiteClusterSecondMoment - a.finiteClusterSecondMoment,
  )[0];
  const secondMomentPeakPoint = secondMomentPeak
    ? secondMomentPoints.find(
        (point) => point.threshold === secondMomentPeak.threshold,
      )
    : null;

  return (
    <WorkstationPanel className="mt-6 overflow-hidden">
      <div className="border-b border-zinc-200 px-5 py-4">
        <h2 className="text-base font-semibold text-zinc-950">
          {title}
        </h2>
        <p className="mt-1 text-sm leading-6 text-zinc-600">
          {description}
        </p>
      </div>
      <div className="grid gap-0 lg:grid-cols-[1fr_320px]">
        <div className="overflow-x-auto border-b border-zinc-200 p-4 lg:border-r lg:border-b-0">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-[220px] min-w-[680px] w-full"
            role="img"
            aria-label={`${title} largest component and second moment chart`}
          >
            <line
              x1={padding}
              y1={height - padding}
              x2={width - padding}
              y2={height - padding}
              stroke="#d4d4d8"
            />
            <line
              x1={padding}
              y1={padding}
              x2={padding}
              y2={height - padding}
              stroke="#d4d4d8"
            />
            {[0, 0.25, 0.5, 0.75, 1].map((threshold) => {
              const x = padding + threshold * (width - padding * 2);

              return (
                <g key={threshold}>
                  <line
                    x1={x}
                    y1={padding}
                    x2={x}
                    y2={height - padding}
                    stroke="#e4e4e7"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={x}
                    y={height - 8}
                    textAnchor="middle"
                    className="fill-zinc-500 font-mono text-[10px]"
                  >
                    {threshold.toFixed(2)}
                  </text>
                </g>
              );
            })}
            <path
              d={largestComponentPath}
              fill="none"
              stroke="#173b35"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <path
              d={secondMomentPath}
              fill="none"
              stroke="#2563eb"
              strokeWidth="2"
              strokeDasharray="2 5"
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity="0.9"
            />
            {secondMomentPeakPoint ? (
              <g>
                <circle
                  cx={secondMomentPeakPoint.x}
                  cy={secondMomentPeakPoint.y}
                  r="4"
                  fill="#2563eb"
                  stroke="#ffffff"
                  strokeWidth="2"
                />
                <text
                  x={secondMomentPeakPoint.x}
                  y={Math.max(14, secondMomentPeakPoint.y - 8)}
                  textAnchor="middle"
                  className="fill-[#1d4ed8] font-mono text-[10px]"
                >
                  {secondMomentPeakPoint.threshold.toFixed(2)}
                </text>
              </g>
            ) : null}
            <text
              x={padding}
              y={16}
              className="fill-zinc-500 font-mono text-[10px]"
            >
              largest component / second moment
            </text>
            <text
              x={width - padding}
              y={height - 8}
              textAnchor="end"
              className="fill-zinc-500 font-mono text-[10px]"
            >
              threshold
            </text>
          </svg>
        </div>
        <div className="p-4">
          <div className="mb-4 grid gap-2 border-b border-zinc-200 pb-4">
            <div className="flex items-center gap-2 text-xs text-zinc-600">
              <span className="h-1.5 w-8 bg-[#173b35]" />
              largest component
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-600">
              <span className="h-0 w-8 border-t-2 border-dotted border-[#2563eb]" />
              finite cluster second moment
            </div>
          </div>
          {secondMomentPeak ? (
            <div className="mb-4 border-b border-zinc-200 pb-4 text-sm text-zinc-600">
              <div className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                second moment peak
              </div>
              <div className="mt-2">
                threshold{" "}
                <span className="font-mono font-semibold text-zinc-950">
                  {secondMomentPeak.threshold.toFixed(2)}
                </span>
                , second moment{" "}
                <span className="font-mono font-semibold text-zinc-950">
                  {secondMomentPeak.finiteClusterSecondMoment.toFixed(0)}
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </WorkstationPanel>
  );
}

function PercolationBridgeSignals({
  overview,
}: {
  overview: TickerSignalCombinationOverview;
}) {
  const analyses = overview.percolationBridgeAnalyses ?? [];

  if (analyses.length === 0) return null;

  return (
    <WorkstationPanel className="mt-6 overflow-hidden">
      <div className="border-b border-zinc-200 px-5 py-4">
        <div className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
          percolation split analysis
        </div>
        <h2 className="mt-2 text-base font-semibold text-zinc-950">
          Baseline, boundary, and post-break identity signals
        </h2>
        <p className="mt-1 text-sm leading-6 text-zinc-600">
          The first split shows the earliest visible crack in the largest
          component. The second-moment peak shows where fragmentation becomes
          structurally large.
        </p>
        <div className="mt-3 grid gap-2 border border-zinc-200 bg-[#fbfaf5] p-3 font-mono text-[11px] leading-5 text-zinc-600 md:grid-cols-2">
          <div>
            <span className="font-semibold text-zinc-950">lift</span> = local
            share / pre-break baseline share. Values above 1.00x mean the signal
            is over-represented versus the pre-break largest component.
          </div>
          <div>
            <span className="font-semibold text-zinc-950">contrast</span> =
            piece share - strongest comparable piece share. Positive values mean
            the signal separates that post-break piece from other major pieces.
          </div>
        </div>
      </div>

      <div className="grid gap-4 p-4">
        {analyses.map((analysis) => (
          <section
            key={`${analysis.lens}-${analysis.label}`}
            className="border border-zinc-200 bg-white p-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-zinc-950">
                  {analysis.label}
                </h3>
                <p className="mt-1 text-xs leading-5 text-zinc-600">
                  threshold {analysis.previousThreshold.toFixed(2)} →{" "}
                  {analysis.peakThreshold.toFixed(2)}, peak moment{" "}
                  {analysis.peakMoment.toFixed(1)}
                </p>
              </div>
              <div className="shrink-0 border border-zinc-200 bg-[#fbfaf5] px-3 py-2 text-right font-mono text-[11px] leading-5 text-zinc-600">
                {analysis.bridgeEdgeCount} boundary edges
                <br />
                {analysis.removedEdgeCount} removed edges
              </div>
            </div>

            <div className="mt-4 border border-[#173b35]/25 bg-[#f4f7f2] p-4">
              <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#31534c]">
                Interpretive read
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-700">
                {buildBaselineNarrative(analysis)}
              </p>
              <p className="mt-2 text-xs leading-5 text-zinc-600">
                {buildBoundaryNarrative(analysis)}
              </p>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
              <div className="border border-zinc-200 bg-white px-2 py-2">
                <div className="font-mono font-semibold text-zinc-950">
                  {analysis.largestBeforeSize}
                </div>
                <div className="text-zinc-500">before largest</div>
              </div>
              <div className="border border-zinc-200 bg-white px-2 py-2">
                <div className="font-mono font-semibold text-zinc-950">
                  {analysis.largestAfterPieceCount}
                </div>
                <div className="text-zinc-500">after pieces</div>
              </div>
              <div className="border border-zinc-200 bg-white px-2 py-2">
                <div className="font-mono font-semibold text-zinc-950">
                  {analysis.largestAfterSize}
                </div>
                <div className="text-zinc-500">largest piece</div>
              </div>
            </div>

            <div className="mt-4">
              <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                1. pre-break baseline signals
              </div>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                Counted across all groups inside the largest component just
                before it splits.
              </p>
              <div className="mt-3 grid gap-2">
                {(analysis.preBreakBaselineSignals ?? [])
                  .slice(0, 5)
                  .map((signalSummary) => (
                    <div
                      key={`${analysis.lens}-baseline-${signalSummary.signal.token}`}
                    >
                      <div className="mb-1 flex items-start justify-between gap-2 text-xs">
                        <span className="min-w-0 break-words font-medium text-zinc-700">
                          {signalSummary.signal.token}
                        </span>
                        <span className="shrink-0 font-mono text-[11px] text-zinc-600">
                          {formatPercent(signalSummary.share)}
                        </span>
                      </div>
                      <div className="h-1.5 border border-zinc-300 bg-[#f2f3ef]">
                        <div
                          className="h-full bg-[#173b35]"
                          style={{
                            width: `${Math.max(3, signalSummary.share * 100)}%`,
                          }}
                        />
                      </div>
                      <div className="mt-1 font-mono text-[10px] text-zinc-500">
                        ticker share, group share{" "}
                        {formatPercent(signalSummary.groupShare)}
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div className="mt-5 border-t border-zinc-200 pt-4">
              <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                2. boundary connecting signals
              </div>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                Counted only on removed edges whose two endpoints land in
                different post-break pieces.
              </p>
              <div className="mt-3 grid gap-2">
                {(analysis.topBridgeSignals ?? []).map((signalSummary) => (
                  <div key={`${analysis.lens}-${signalSummary.signal.token}`}>
                    <div className="mb-1 flex items-start justify-between gap-2 text-xs">
                      <span className="min-w-0 break-words font-medium text-zinc-700">
                        {signalSummary.signal.token}
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-zinc-600">
                        {formatPercent(signalSummary.share)}
                      </span>
                    </div>
                    <div className="h-1.5 border border-zinc-300 bg-[#f2f3ef]">
                      <div
                        className="h-full bg-[#8a4b24]"
                        style={{
                          width: `${Math.max(3, signalSummary.share * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="mt-1 font-mono text-[10px] text-zinc-500">
                      {signalSummary.edgeCount} edges, avg sim{" "}
                      {signalSummary.averageSimilarity.toFixed(2)}
                      <br />
                      baseline {formatPercent(signalSummary.baselineShare)}, lift{" "}
                      {formatRatio(signalSummary.lift)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 border-t border-zinc-200 pt-4">
              <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                3. post-break identity signals
              </div>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                Counted inside each resulting piece after the threshold gets
                stricter.
              </p>
              <div className="mt-3 grid gap-3 xl:grid-cols-3">
                {(analysis.postBreakPieces ?? []).slice(0, 3).map((piece) => (
                  <div
                    key={`${analysis.lens}-piece-${piece.familyId}`}
                    className="border border-zinc-200 bg-[#fbfaf5] p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                        Piece {piece.familyId}
                      </div>
                      <div className="shrink-0 text-right font-mono text-[11px] text-zinc-600">
                        {piece.groupCount} groups
                        <br />
                        {piece.tickerCount} tickers
                      </div>
                    </div>
                    <div className="mt-3 grid gap-1.5">
                      <div className="border border-zinc-200 bg-white px-2 py-2 text-xs leading-5 text-zinc-600">
                        {buildPieceNarrative(piece)}
                      </div>
                      {piece.topSignals.slice(0, 3).map((signalSummary) => (
                        <div
                          key={`${analysis.lens}-piece-${piece.familyId}-${signalSummary.signal.token}`}
                          className="grid gap-1"
                        >
                          <div className="flex items-start justify-between gap-2 text-xs">
                            <span className="min-w-0 break-words text-zinc-700">
                              {signalSummary.signal.token}
                            </span>
                            <span className="shrink-0 font-mono text-[11px] text-zinc-600">
                              {formatPercent(signalSummary.share)}
                            </span>
                          </div>
                          <div className="font-mono text-[10px] text-zinc-500">
                            baseline{" "}
                            {formatPercent(signalSummary.baselineShare ?? 0)}, lift{" "}
                            {formatRatio(signalSummary.lift)}, contrast{" "}
                            {formatSignedPercent(signalSummary.contrastShare)}
                            <br />
                            group share {formatPercent(signalSummary.groupShare)}
                          </div>
                        </div>
                      ))}
                    </div>
                    {piece.marketAudit ? (
                      <div className="mt-3 border-t border-zinc-200 pt-3">
                        <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                          Market audit
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                          <div className="border border-zinc-200 bg-white px-2 py-1.5">
                            <div className="font-mono font-semibold text-zinc-950">
                              {formatMarketCap(piece.marketAudit.totalMarketCap)}
                            </div>
                            <div className="text-zinc-500">total market cap</div>
                          </div>
                          <div className="border border-zinc-200 bg-white px-2 py-1.5">
                            <div className="font-mono font-semibold text-zinc-950">
                              {formatMarketCap(piece.marketAudit.medianMarketCap)}
                            </div>
                            <div className="text-zinc-500">median market cap</div>
                          </div>
                        </div>
                        {piece.marketAudit.universeOverlaps.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {piece.marketAudit.universeOverlaps
                              .slice(0, 4)
                              .map((overlap) => (
                                <span
                                  key={`${analysis.lens}-piece-${piece.familyId}-universe-${overlap.universeKey}`}
                                  className="border border-zinc-200 bg-white px-2 py-1 font-mono text-[10px] text-zinc-600"
                                >
                                  {overlap.universeLabel} {overlap.count} /{" "}
                                  {formatPercent(overlap.share)}
                                </span>
                              ))}
                          </div>
                        ) : null}
                        <div className="mt-2 grid gap-2 md:grid-cols-2">
                          <div className="border border-zinc-200 bg-white px-2 py-1.5">
                            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                              sectors
                            </div>
                            <div className="mt-1 grid gap-1">
                              {piece.marketAudit.sectorStats
                                .slice(0, 3)
                                .map((stat) => (
                                  <div
                                    key={`${analysis.lens}-piece-${piece.familyId}-sector-${stat.name}`}
                                    className="flex justify-between gap-2 text-[10px] text-zinc-600"
                                  >
                                    <span className="min-w-0 truncate">
                                      {stat.name}
                                    </span>
                                    <span className="shrink-0 font-mono">
                                      {formatPercent(stat.share)}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          </div>
                          <div className="border border-zinc-200 bg-white px-2 py-1.5">
                            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                              industries
                            </div>
                            <div className="mt-1 grid gap-1">
                              {piece.marketAudit.industryStats
                                .slice(0, 3)
                                .map((stat) => (
                                  <div
                                    key={`${analysis.lens}-piece-${piece.familyId}-industry-${stat.name}`}
                                    className="flex justify-between gap-2 text-[10px] text-zinc-600"
                                  >
                                    <span className="min-w-0 truncate">
                                      {stat.name}
                                    </span>
                                    <span className="shrink-0 font-mono">
                                      {formatPercent(stat.share)}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 grid gap-1">
                          {piece.marketAudit.topMembers.slice(0, 5).map((member) => (
                            <div
                              key={`${analysis.lens}-piece-${piece.familyId}-member-${member.ticker}`}
                              className="grid grid-cols-[52px_1fr_auto] gap-2 border border-zinc-200 bg-white px-2 py-1.5 text-[10px]"
                            >
                              <Link
                                href={`/tickers/${member.ticker}`}
                                target="_blank"
                                rel="noreferrer"
                                className="font-mono font-semibold text-zinc-950 underline decoration-[#b88a2f] underline-offset-2 hover:text-[#173b35]"
                              >
                                {member.ticker}
                              </Link>
                              <span className="min-w-0 truncate text-zinc-600">
                                {member.companyName ?? "-"}
                              </span>
                              <span className="font-mono text-zinc-500">
                                {formatMarketCap(member.marketCap)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {piece.featureAudit ? (
                      <div className="mt-3 border-t border-zinc-200 pt-3">
                        <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                          Feature audit
                        </div>
                        <p className="mt-1 text-[11px] leading-4 text-zinc-500">
                          Median feature contrast vs the pre-break baseline,
                          ranked by baseline-IQR adjusted distance.
                        </p>
                        <div className="mt-2 grid gap-1.5">
                          {piece.featureAudit.topFeatures
                            .slice(0, 3)
                            .map((feature) => (
                              <div
                                key={`${analysis.lens}-piece-${piece.familyId}-feature-${feature.featureToken}`}
                                className="border border-zinc-200 bg-white px-2 py-1.5"
                              >
                                <div className="flex items-start justify-between gap-2 text-[11px]">
                                  <span className="min-w-0 break-words font-mono text-zinc-700">
                                    {feature.featureToken}
                                  </span>
                                  <span className="shrink-0 font-mono font-semibold text-zinc-950">
                                    {formatFeatureValue(feature.robustDelta ?? 0)}
                                  </span>
                                </div>
                                <div className="mt-1 font-mono text-[10px] leading-4 text-zinc-500">
                                  piece{" "}
                                  {formatAuditFeatureValue(feature.pieceMedian)}{" "}
                                  vs baseline{" "}
                                  {formatAuditFeatureValue(
                                    feature.baselineMedian,
                                  )}
                                  , coverage{" "}
                                  {formatPercent(feature.pieceCoverage)} /{" "}
                                  {formatPercent(feature.baselineCoverage)}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    ) : null}
                    {piece.hammingAudit ? (
                      <div className="mt-3 border-t border-zinc-200 pt-3">
                        <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                          Hamming audit
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                          <div className="border border-zinc-200 bg-white px-2 py-1.5">
                            <div className="font-mono font-semibold text-zinc-950">
                              {formatNumber(piece.hammingAudit.averageSimilarity)}
                            </div>
                            <div className="text-zinc-500">avg similarity</div>
                          </div>
                          <div className="border border-zinc-200 bg-white px-2 py-1.5">
                            <div className="font-mono font-semibold text-zinc-950">
                              {piece.hammingAudit.subclusterCount}
                            </div>
                            <div className="text-zinc-500">
                              subclusters @{" "}
                              {piece.hammingAudit.threshold.toFixed(2)}
                            </div>
                          </div>
                          <div className="border border-zinc-200 bg-white px-2 py-1.5">
                            <div className="font-mono font-semibold text-zinc-950">
                              {formatPercent(
                                piece.hammingAudit.largestSubclusterShare,
                              )}
                            </div>
                            <div className="text-zinc-500">
                              largest subcluster
                            </div>
                          </div>
                          <div className="border border-zinc-200 bg-white px-2 py-1.5">
                            <div className="font-mono font-semibold text-zinc-950">
                              {piece.hammingAudit.singletonSubclusterCount}
                            </div>
                            <div className="text-zinc-500">singletons</div>
                          </div>
                        </div>
                        {piece.hammingAudit.stateDiversity.length > 0 ? (
                          <div className="mt-2 grid gap-1.5">
                            {piece.hammingAudit.stateDiversity
                              .slice(0, 3)
                              .map((item) => (
                                <div
                                  key={`${analysis.lens}-piece-${piece.familyId}-audit-${item.factorAxis}`}
                                  className="font-mono text-[10px] leading-4 text-zinc-500"
                                >
                                  <span className="text-zinc-700">
                                    {item.factorAxis}
                                  </span>
                                  : {item.distinctStateCount} states, dominant{" "}
                                  {item.dominantState}{" "}
                                  {formatPercent(item.dominantShare)}
                                </div>
                              ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </section>
        ))}
      </div>
    </WorkstationPanel>
  );
}

function CommunityDetectionSection({
  overview,
}: {
  overview: TickerSignalCombinationOverview;
}) {
  const analyses = overview.communityAnalyses ?? [];

  if (analyses.length === 0) return null;

  const louvain = analyses.find((analysis) => analysis.method === "louvain");

  return (
    <WorkstationPanel className="mt-6 overflow-hidden">
      <div className="border-b border-zinc-200 px-5 py-4">
        <div className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
          clustering v2 boundary
        </div>
        <h2 className="mt-2 text-base font-semibold text-zinc-950">
          Signal similarity communities move to Clustering v2
        </h2>
        <p className="mt-1 text-sm leading-6 text-zinc-600">
          Community detection is better suited to thesis-specific lenses, such
          as state-capitalism beneficiaries, geopolitics exposure, or stress
          resilience pockets. This v1 page keeps the focus on broad U.S. market
          signal structure and uses the community models only as a deferred
          research boundary.
        </p>
      </div>
      <div className="grid gap-0 md:grid-cols-3">
        <div className="border-b border-zinc-200 p-4 md:border-r md:border-b-0">
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            deferred methods
          </div>
          <div className="mt-2 text-sm font-semibold text-zinc-950">
            Louvain / Infomap / MCL
          </div>
          <p className="mt-1 text-xs leading-5 text-zinc-600">
            These are still useful, but their strongest role is finding local
            dense pockets inside a chosen strategic lens rather than explaining
            the broad market baseline.
          </p>
        </div>
        <div className="border-b border-zinc-200 p-4 md:border-r md:border-b-0">
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            current graph snapshot
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
            <div className="border border-zinc-200 bg-[#fbfaf5] px-2 py-2">
              <div className="font-mono font-semibold text-zinc-950">
                {analyses.length}
              </div>
              <div className="text-zinc-500">models</div>
            </div>
            <div className="border border-zinc-200 bg-[#fbfaf5] px-2 py-2">
              <div className="font-mono font-semibold text-zinc-950">
                {louvain?.communityCount ?? "-"}
              </div>
              <div className="text-zinc-500">Louvain groups</div>
            </div>
            <div className="border border-zinc-200 bg-[#fbfaf5] px-2 py-2">
              <div className="font-mono font-semibold text-zinc-950">
                {louvain?.largestCommunitySize ?? "-"}
              </div>
              <div className="text-zinc-500">largest</div>
            </div>
          </div>
        </div>
        <div className="p-4">
          <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            v2 question shape
          </div>
          <p className="mt-2 text-xs leading-5 text-zinc-600">
            Build a filtered signal graph first, then run communities: defense
            and reshoring, rate and credit stress, AI infrastructure,
            commodity/energy exposure, or another explicit thesis.
          </p>
        </div>
      </div>
    </WorkstationPanel>
  );
}

function LatestFlowInterpretation({
  overview,
}: {
  overview: TickerSignalCombinationOverview;
}) {
  const analysis =
    overview.percolationBridgeAnalyses.find((item) =>
      item.label.includes("percolation split"),
    ) ??
    overview.percolationBridgeAnalyses[0] ??
    null;

  if (!analysis) return null;

  return (
    <WorkstationPanel className="mt-6 overflow-hidden">
      <div className="border-b border-zinc-200 px-5 py-4">
        <div className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
          latest flow interpretation
        </div>
        <h2 className="mt-2 text-base font-semibold text-zinc-950">
          Current market core at the peak fragmentation split
        </h2>
        <p className="mt-1 text-sm leading-6 text-zinc-600">
          This page only calculates the latest signal network. Historical
          quarter-end flow and turnover belong on the timeline page.
        </p>
      </div>

      <div className="grid gap-0 lg:grid-cols-[1fr_360px]">
        <div className="border-b border-zinc-200 p-5 lg:border-r lg:border-b-0">
          <div className="border border-[#173b35]/25 bg-[#f4f7f2] p-4">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#31534c]">
              Interpretive read
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-700">
              {buildBaselineNarrative(analysis)}
            </p>
            <p className="mt-2 text-xs leading-5 text-zinc-600">
              {buildBoundaryNarrative(analysis)}
            </p>
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <div>
              <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                pre-break baseline signals
              </div>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                Shared signals inside the largest component immediately before
                the split.
              </p>
              <div className="mt-3 grid gap-2">
                {analysis.preBreakBaselineSignals.slice(0, 5).map((signal) => (
                  <div key={`latest-baseline-${signal.signal.token}`}>
                    <div className="mb-1 flex items-start justify-between gap-2 text-xs">
                      <span className="min-w-0 break-words font-medium text-zinc-700">
                        {signal.signal.token}
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-zinc-600">
                        {formatPercent(signal.share)}
                      </span>
                    </div>
                    <div className="h-1.5 border border-zinc-300 bg-[#f2f3ef]">
                      <div
                        className="h-full bg-[#173b35]"
                        style={{ width: `${Math.max(3, signal.share * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                boundary connecting signals
              </div>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                Shared signals on cross-piece edges that disappear at the split.
              </p>
              <div className="mt-3 grid gap-2">
                {analysis.topBridgeSignals.slice(0, 5).map((signal) => (
                  <div key={`latest-boundary-${signal.signal.token}`}>
                    <div className="mb-1 flex items-start justify-between gap-2 text-xs">
                      <span className="min-w-0 break-words font-medium text-zinc-700">
                        {signal.signal.token}
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-zinc-600">
                        {formatPercent(signal.share)}
                      </span>
                    </div>
                    <div className="h-1.5 border border-zinc-300 bg-[#f2f3ef]">
                      <div
                        className="h-full bg-[#8a4b24]"
                        style={{ width: `${Math.max(3, signal.share * 100)}%` }}
                      />
                    </div>
                    <div className="mt-1 font-mono text-[10px] text-zinc-500">
                      {signal.edgeCount} edges · baseline{" "}
                      {formatPercent(signal.baselineShare)} · lift{" "}
                      {formatRatio(signal.lift)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 p-5 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div className="border border-zinc-200 bg-[#fbfaf5] px-3 py-3">
              <div className="font-mono font-semibold text-zinc-950">
                {analysis.previousThreshold.toFixed(2)} →{" "}
                {analysis.peakThreshold.toFixed(2)}
              </div>
              <div className="text-xs text-zinc-500">threshold</div>
            </div>
            <div className="border border-zinc-200 bg-[#fbfaf5] px-3 py-3">
              <div className="font-mono font-semibold text-zinc-950">
                {analysis.peakMoment.toFixed(1)}
              </div>
              <div className="text-xs text-zinc-500">second moment</div>
            </div>
            <div className="border border-zinc-200 bg-[#fbfaf5] px-3 py-3">
              <div className="font-mono font-semibold text-zinc-950">
                {analysis.largestBeforeSize} → {analysis.largestAfterSize}
              </div>
              <div className="text-xs text-zinc-500">largest component</div>
            </div>
            <div className="border border-zinc-200 bg-[#fbfaf5] px-3 py-3">
              <div className="font-mono font-semibold text-zinc-950">
                {analysis.bridgeEdgeCount}
              </div>
              <div className="text-xs text-zinc-500">boundary edges</div>
            </div>
          </div>
          <Link
            href="/market/cluster/timeline"
            className="inline-flex justify-center border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-[#fbfaf5]"
          >
            Open quarter-end flow timeline
          </Link>
        </div>
      </div>
    </WorkstationPanel>
  );
}

function SignalCombinationOverviewView({
  overview,
}: {
  overview: TickerSignalCombinationOverview;
}) {
  return (
    <>
      <section className="border-b border-zinc-300 pb-7">
        <div className="font-mono text-xs font-semibold uppercase tracking-[0.24em] text-[#6d5a2d]">
          Market Signal Overview
        </div>
        <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 md:text-4xl">
              Exact signal combination groups
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
              Companies are grouped only when their full active factor signal set
              is identical. This is segmentation by signal pattern, not
              distance-based clustering.
            </p>
            <Link
              href="/market/cluster/timeline"
              className="mt-4 inline-flex border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-[#fbfaf5]"
            >
              Open quarter-end flow timeline
            </Link>
          </div>
          <div className="grid min-w-full grid-cols-3 border border-zinc-950 bg-white text-right shadow-[4px_4px_0_0_rgba(24,24,27,0.12)] sm:min-w-[420px]">
            <div className="border-r border-zinc-200 px-3 py-3">
              <div className="text-2xl font-semibold text-zinc-950">
                {overview.tickerCount}
              </div>
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                tickers
              </div>
            </div>
            <div className="border-r border-zinc-200 px-3 py-3">
              <div className="text-2xl font-semibold text-zinc-950">
                {overview.signalDimensionCount}
              </div>
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                signals
              </div>
            </div>
            <div className="px-3 py-3">
              <div className="text-2xl font-semibold text-zinc-950">
                {overview.groupCount}
              </div>
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                groups
              </div>
            </div>
          </div>
        </div>
      </section>

      <WorkstationPanel className="mt-6 overflow-hidden">
        <div className="grid gap-0 text-sm md:grid-cols-3">
            <div className="border-b border-zinc-200 p-4 md:border-r md:border-b-0">
              <div className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">
                grouping method
              </div>
              <div className="mt-1 font-medium text-zinc-950">
                exact combination
              </div>
            </div>
            <div className="border-b border-zinc-200 p-4 md:border-r md:border-b-0">
              <div className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">
                factor axes
              </div>
              <div className="mt-1 font-medium text-zinc-950">
                {overview.factorAxisCount}
              </div>
            </div>
            <div className="p-4">
              <div className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">
                as of
              </div>
              <div className="mt-1 break-words font-medium text-zinc-950">
                {overview.asOfDate ?? "-"}
              </div>
            </div>
          </div>
      </WorkstationPanel>

      {overview.idfWeightedJaccardThresholdStats.length > 0 ? (
        <ThresholdFamilyChart overview={overview} lens="idfWeightedJaccard" />
      ) : null}

      {overview.unavailableReason ? (
        <section className="mt-6 border border-[#b88a2f] bg-[#fff8df] p-5 font-mono text-xs leading-6 text-[#6d3f13] shadow-[4px_4px_0_0_rgba(184,138,47,0.16)]">
          {overview.unavailableReason}
        </section>
      ) : null}

      {overview.percolationBridgeAnalyses.length === 0 ? (
        <WorkstationPanel className="mt-6 p-6">
          <h2 className="text-lg font-semibold text-zinc-950">
            No latest market core split yet
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Run the factor signal workflow first, then this page can group
            tickers by their current selected signal set and calculate the
            latest percolation split.
          </p>
        </WorkstationPanel>
      ) : (
        <LatestFlowInterpretation overview={overview} />
      )}
    </>
  );
}

export function MarketClusterOverview() {
  const [overview, setOverview] =
    useState<TickerSignalCombinationOverview | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    fetchSignalCombinationOverview()
      .then((nextOverview) => {
        if (!isMounted) return;
        setOverview(nextOverview);
        setErrorMessage(null);
      })
      .catch((error) => {
        if (!isMounted) return;
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to fetch signal combination overview.",
        );
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (errorMessage) {
    return (
      <MarketClusterOverviewShell>
        <WorkstationPanel className="p-6">
          <h1 className="text-lg font-semibold text-zinc-950">
            Failed to load the market signal overview
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            {errorMessage}
          </p>
        </WorkstationPanel>
      </MarketClusterOverviewShell>
    );
  }

  if (!overview) {
    return (
      <MarketClusterOverviewShell>
        <WorkstationPanel className="p-6">
          <h1 className="text-lg font-semibold text-zinc-950">
            Loading market overview
          </h1>
        </WorkstationPanel>
      </MarketClusterOverviewShell>
    );
  }

  return (
    <MarketClusterOverviewShell>
      <SignalCombinationOverviewView overview={overview} />
    </MarketClusterOverviewShell>
  );
}
