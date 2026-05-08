"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { TickerFactorMetricClusterOverview } from "@/shared/market/clusterOverview";
import type { TickerSignalCombinationOverview } from "@/shared/market/signalCombinationOverview";
import { fetchMarketClusterOverview } from "@/features/market/services/fetchMarketClusterOverview";
import { fetchSignalCombinationOverview } from "@/features/market/services/fetchSignalCombinationOverview";
import {
  WorkstationFrame,
  WorkstationPanel,
} from "@/features/workstation/components/WorkstationChrome";

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value: number | null) {
  return value === null ? "-" : value.toFixed(2);
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

function formatFeatureValue(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}`;
}

function formatScope(factor: string, axis: string) {
  return `${factor}.${axis}`;
}

function splitScope(value: string) {
  return [...new Set(value.split("+").filter(Boolean))];
}

function isCombinedScope(factor: string, axis: string) {
  return factor.includes("+") || axis.includes("+");
}

function formatScopeSummary(factor: string, axis: string) {
  if (!isCombinedScope(factor, axis)) return formatScope(factor, axis);

  const factors = splitScope(factor);
  const axes = splitScope(axis);

  return `${factors.length} factors / ${axes.length} axes`;
}

function formatScopeDetail(factor: string, axis: string) {
  if (!isCombinedScope(factor, axis)) return formatScope(factor, axis);

  const factors = splitScope(factor).join(", ");
  const axes = splitScope(axis).join(", ");

  return `${factors} | ${axes}`;
}

function formatDimensionLabel(overview: TickerFactorMetricClusterOverview) {
  return overview.latestRun?.vectorMode === "factor_signal"
    ? "signals"
    : "features";
}

function getSignalProfileFeatures(
  profile: ClusterProfile,
  signalCohortView: boolean,
) {
  const features = signalCohortView
    ? profile.distinguishingFeatures.filter((feature) => Math.abs(feature.value) > 0)
    : profile.distinguishingFeatures;

  return sortFeaturesForComparison(features);
}

const SIGNAL_DISPLAY: Record<
  string,
  {
    label: string;
    shortLabel: string;
    high: string;
    low: string;
  }
> = {
  latestGrowth: {
    label: "Recent growth",
    shortLabel: "Recent",
    high: "recent growth is strong",
    low: "recent growth is muted",
  },
  durableGrowth: {
    label: "Durable growth",
    shortLabel: "Durable",
    high: "durable growth is strong",
    low: "durable growth is weak",
  },
  consistency: {
    label: "Consistency",
    shortLabel: "Consistency",
    high: "growth pattern is steady",
    low: "growth pattern is uneven",
  },
  yoyGrowthAcceleration: {
    label: "YoY growth acceleration",
    shortLabel: "YoY accel.",
    high: "momentum is improving",
    low: "momentum is cooling",
  },
  trendDeviation: {
    label: "Trend deviation",
    shortLabel: "Deviation",
    high: "results are above normal trend",
    low: "results are below normal trend",
  },
  turnaroundMomentum: {
    label: "Turnaround momentum",
    shortLabel: "Turnaround",
    high: "turnaround momentum is positive",
    low: "turnaround momentum is negative",
  },
  profitabilityConsistency: {
    label: "Profitability consistency",
    shortLabel: "Profit consistency",
    high: "profitability pattern is steady",
    low: "profitability pattern is uneven",
  },
  profitabilityPosition: {
    label: "Profitability position",
    shortLabel: "Profit position",
    high: "profitability is above normal run-rate",
    low: "profitability is below normal run-rate",
  },
  profitabilityTurnaround: {
    label: "Profitability turnaround",
    shortLabel: "Turnaround",
    high: "profitability is turning around",
    low: "profitability is deteriorating",
  },
  cashEarningsCoverage: {
    label: "Cash earnings coverage",
    shortLabel: "Cash coverage",
    high: "earnings are backed by operating cash flow",
    low: "cash support for earnings is thin",
  },
  accrualsToAssets: {
    label: "Accruals to assets",
    shortLabel: "Accruals",
    high: "accruals pressure is high",
    low: "accruals pressure is low",
  },
  grossProfitToAssets: {
    label: "Gross profit to assets",
    shortLabel: "GP/assets",
    high: "gross profit asset efficiency is high",
    low: "gross profit asset efficiency is low",
  },
  operatingReturnOnAssets: {
    label: "Operating return on assets",
    shortLabel: "Op. ROA",
    high: "operating asset efficiency is high",
    low: "operating asset efficiency is low",
  },
  netIncomeReturnOnAssets: {
    label: "Net income return on assets",
    shortLabel: "NI ROA",
    high: "net income asset efficiency is high",
    low: "net income asset efficiency is low",
  },
  capexInvestmentIntensityChange: {
    label: "CapEx intensity change",
    shortLabel: "CapEx intensity",
    high: "investment activity is ramping",
    low: "investment activity is muted",
  },
  capexCycleAcceleration: {
    label: "CapEx acceleration",
    shortLabel: "CapEx accel.",
    high: "investment pace is accelerating",
    low: "investment pace is cooling",
  },
  capexCycleQuarterStretch: {
    label: "CapEx quarter stretch",
    shortLabel: "CapEx quarter",
    high: "investment activity is above trend",
    low: "investment activity is below trend",
  },
  capexCycleAnnualStretch: {
    label: "CapEx annual stretch",
    shortLabel: "CapEx annual",
    high: "investment activity is up year over year",
    low: "investment activity is down year over year",
  },
  energyActivityGrowth: {
    label: "Energy activity growth",
    shortLabel: "Energy activity",
    high: "energy-linked activity is growing",
    low: "energy-linked activity is fading",
  },
  energyActivityAcceleration: {
    label: "Energy activity acceleration",
    shortLabel: "Energy accel.",
    high: "energy-linked activity is accelerating",
    low: "energy-linked activity is decelerating",
  },
  energyActivityStretch: {
    label: "Energy activity stretch",
    shortLabel: "Energy stretch",
    high: "energy-linked activity is above recent run-rate",
    low: "energy-linked activity is below recent run-rate",
  },
  energyAssetInventoryGrowth: {
    label: "Energy asset and inventory growth",
    shortLabel: "Energy assets",
    high: "energy assets or inventory are building",
    low: "energy assets or inventory are shrinking",
  },
  energyAssetInventoryAcceleration: {
    label: "Energy asset and inventory acceleration",
    shortLabel: "Asset accel.",
    high: "energy assets or inventory are building faster",
    low: "energy assets or inventory build is slowing",
  },
  energyAssetInventoryStretch: {
    label: "Energy asset and inventory stretch",
    shortLabel: "Asset stretch",
    high: "energy assets or inventory are elevated",
    low: "energy assets or inventory are below recent run-rate",
  },
  energyCostPressure: {
    label: "Energy cost pressure",
    shortLabel: "Energy cost",
    high: "energy input costs are rising",
    low: "energy input costs are easing",
  },
  energyCostAcceleration: {
    label: "Energy cost acceleration",
    shortLabel: "Cost accel.",
    high: "energy input costs are accelerating",
    low: "energy input costs are decelerating",
  },
  energyCostStretch: {
    label: "Energy cost stretch",
    shortLabel: "Cost stretch",
    high: "energy input costs are above recent run-rate",
    low: "energy input costs are below recent run-rate",
  },
  receivablesChange: {
    label: "Receivables change",
    shortLabel: "AR change",
    high: "receivables are increasing",
    low: "receivables are decreasing",
  },
  receivablesBuild: {
    label: "Receivables build",
    shortLabel: "AR build",
    high: "receivables are above recent run-rate",
    low: "receivables are below recent run-rate",
  },
  receivablesToRevenue: {
    label: "Receivables to revenue",
    shortLabel: "AR/revenue",
    high: "receivables are high versus revenue",
    low: "receivables are low versus revenue",
  },
  inventoryChange: {
    label: "Inventory change",
    shortLabel: "Inv. change",
    high: "inventory is increasing",
    low: "inventory is decreasing",
  },
  inventoryBuild: {
    label: "Inventory build",
    shortLabel: "Inv. build",
    high: "inventory is above recent run-rate",
    low: "inventory is below recent run-rate",
  },
  inventoryToRevenue: {
    label: "Inventory to revenue",
    shortLabel: "Inv./revenue",
    high: "inventory is high versus revenue",
    low: "inventory is low versus revenue",
  },
  payablesChange: {
    label: "Payables change",
    shortLabel: "AP change",
    high: "payables are increasing",
    low: "payables are decreasing",
  },
  payablesBuild: {
    label: "Payables build",
    shortLabel: "AP build",
    high: "payables are above recent run-rate",
    low: "payables are below recent run-rate",
  },
  payablesToRevenue: {
    label: "Payables to revenue",
    shortLabel: "AP/revenue",
    high: "payables are high versus revenue",
    low: "payables are low versus revenue",
  },
  dividendConsistency: {
    label: "Dividend consistency",
    shortLabel: "Div. consistency",
    high: "dividend pattern is steady",
    low: "dividend pattern is uneven",
  },
  dividendPosition: {
    label: "Dividend position",
    shortLabel: "Div. position",
    high: "dividend run-rate is above trend",
    low: "dividend run-rate is below trend",
  },
  dividendMomentum: {
    label: "Dividend momentum",
    shortLabel: "Div. momentum",
    high: "dividend growth is improving",
    low: "dividend growth is weakening",
  },
  dividendCoverageRatio: {
    label: "Dividend coverage",
    shortLabel: "Div. coverage",
    high: "dividend coverage is strong",
    low: "dividend coverage is thin",
  },
  dividendPayoutRatio: {
    label: "Dividend payout ratio",
    shortLabel: "Payout ratio",
    high: "payout ratio is high",
    low: "payout ratio is low",
  },
  shareCountReduction: {
    label: "Share count reduction",
    shortLabel: "Share count",
    high: "share count is shrinking",
    low: "share count is expanding",
  },
  defensiveStability: {
    label: "Defensive stability",
    shortLabel: "Def. stability",
    high: "defensive support is stable",
    low: "defensive support is unstable",
  },
  defensiveBufferPosition: {
    label: "Defensive buffer position",
    shortLabel: "Buffer pos.",
    high: "defensive buffer is above trend",
    low: "defensive buffer is below trend",
  },
  defensiveShockAbsorption: {
    label: "Defensive shock absorption",
    shortLabel: "Shock absorb.",
    high: "shock absorption is strong",
    low: "shock absorption is weak",
  },
  defensiveBurdenRelief: {
    label: "Defensive burden relief",
    shortLabel: "Burden relief",
    high: "balance-sheet burden is easing",
    low: "balance-sheet burden is rising",
  },
  defensiveBurdenTrendRelief: {
    label: "Defensive burden trend relief",
    shortLabel: "Burden trend",
    high: "balance-sheet burden is below trend",
    low: "balance-sheet burden is above trend",
  },
  defensiveBurdenContractionConsistency: {
    label: "Defensive burden contraction consistency",
    shortLabel: "Burden consistency",
    high: "burden contraction is consistent",
    low: "burden contraction is uneven",
  },
};

const FEATURE_ORDER = [
  "latestGrowth",
  "durableGrowth",
  "consistency",
  "yoyGrowthAcceleration",
  "trendDeviation",
  "turnaroundMomentum",
  "profitabilityConsistency",
  "profitabilityPosition",
  "profitabilityTurnaround",
  "cashEarningsCoverage",
  "accrualsToAssets",
  "grossProfitToAssets",
  "operatingReturnOnAssets",
  "netIncomeReturnOnAssets",
  "capexInvestmentIntensityChange",
  "capexCycleAcceleration",
  "capexCycleQuarterStretch",
  "capexCycleAnnualStretch",
  "energyActivityGrowth",
  "energyActivityAcceleration",
  "energyActivityStretch",
  "energyAssetInventoryGrowth",
  "energyAssetInventoryAcceleration",
  "energyAssetInventoryStretch",
  "energyCostPressure",
  "energyCostAcceleration",
  "energyCostStretch",
  "receivablesChange",
  "receivablesBuild",
  "receivablesToRevenue",
  "inventoryChange",
  "inventoryBuild",
  "inventoryToRevenue",
  "payablesChange",
  "payablesBuild",
  "payablesToRevenue",
  "dividendConsistency",
  "dividendPosition",
  "dividendMomentum",
  "dividendCoverageRatio",
  "dividendPayoutRatio",
  "shareCountReduction",
  "defensiveStability",
  "defensiveBufferPosition",
  "defensiveShockAbsorption",
  "defensiveBurdenRelief",
  "defensiveBurdenTrendRelief",
  "defensiveBurdenContractionConsistency",
];

type ClusterProfile = TickerFactorMetricClusterOverview["profiles"][number];
type ClusterFeature = ClusterProfile["distinguishingFeatures"][number];
type ClusterCategoryStat = ClusterProfile["sectorStats"][number];

function getSignalDisplay(featureKey: string) {
  return (
    SIGNAL_DISPLAY[featureKey] ?? {
      label: featureKey,
      shortLabel: featureKey,
      high: `${featureKey} is high`,
      low: `${featureKey} is low`,
    }
  );
}

function getFeatureDisplayLabel(feature: ClusterFeature) {
  const signalDisplay = getSignalDisplay(feature.featureKey);
  const metricLabel = feature.metricKey;
  const scope = [feature.factorKey, metricLabel].filter(Boolean).join(" / ");

  return scope ? `${scope} / ${signalDisplay.label}` : signalDisplay.label;
}

function getClusterFeatureId(feature: ClusterFeature) {
  return [
    feature.factorKey ?? "",
    feature.axisKey ?? "",
    feature.metricKey,
    feature.featureKey,
  ].join(".");
}

function buildProfileDisplay(profile: ClusterProfile) {
  const strongest = [...profile.distinguishingFeatures]
    .filter((feature) => Math.abs(feature.value) > 0)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  const primary = strongest[0];
  const secondary = strongest[1];

  if (!primary) {
    return {
      title: `Cluster ${profile.clusterId}`,
      summary: "No dominant metric feature is available for this cluster.",
    };
  }

  const primarySignal = getSignalDisplay(primary.featureKey);
  const secondarySignal = secondary
    ? getSignalDisplay(secondary.featureKey)
    : null;
  const primaryPhrase =
    primary.direction === "high" ? primarySignal.high : primarySignal.low;
  const secondaryPhrase =
    secondary && secondarySignal
      ? secondary.direction === "high"
        ? secondarySignal.high
        : secondarySignal.low
      : null;

  return {
    title: chooseClusterTitle(primary, secondary),
    summary: secondaryPhrase
      ? `${capitalize(primaryPhrase)} while ${secondaryPhrase}.`
      : `${capitalize(primaryPhrase)}.`,
  };
}

function chooseClusterTitle(primary: ClusterFeature, secondary?: ClusterFeature) {
  if (
    (primary.featureKey === "consistency" ||
      primary.featureKey === "profitabilityConsistency") &&
    primary.direction === "high"
  ) {
    return secondary?.featureKey === "latestGrowth" && secondary.direction === "low"
      ? "Stable, slower-growth cohort"
      : "Consistent operators";
  }

  if (
    (primary.featureKey === "consistency" ||
      primary.featureKey === "profitabilityConsistency") &&
    primary.direction === "low"
  ) {
    return primary.featureKey === "profitabilityConsistency"
      ? "Uneven quality cohort"
      : "Uneven growth cohort";
  }

  if (
    (primary.featureKey === "turnaroundMomentum" ||
      primary.featureKey === "profitabilityTurnaround") &&
    primary.direction === "high"
  ) {
    return "Turnaround momentum cohort";
  }

  if (
    (primary.featureKey === "latestGrowth" ||
      primary.featureKey === "durableGrowth") &&
    primary.direction === "high"
  ) {
    return "Growth leadership cohort";
  }

  if (
    (primary.featureKey === "trendDeviation" ||
      primary.featureKey === "profitabilityPosition") &&
    primary.direction === "high"
  ) {
    return "Trend-break cohort";
  }

  return `${getSignalDisplay(primary.featureKey).label} cohort`;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function sortFeaturesForComparison(features: ClusterFeature[]) {
  return [...features].sort((a, b) => {
    const aIndex = FEATURE_ORDER.indexOf(a.featureKey);
    const bIndex = FEATURE_ORDER.indexOf(b.featureKey);
    const normalizedAIndex = aIndex === -1 ? FEATURE_ORDER.length : aIndex;
    const normalizedBIndex = bIndex === -1 ? FEATURE_ORDER.length : bIndex;

    return (
      (a.factorKey ?? "").localeCompare(b.factorKey ?? "") ||
      a.metricKey.localeCompare(b.metricKey) ||
      normalizedAIndex - normalizedBIndex ||
      a.featureKey.localeCompare(b.featureKey)
    );
  });
}

function SignalFeatureBar({ feature }: { feature: ClusterFeature }) {
  const magnitude = Math.min(1, Math.abs(feature.value) / 2.5);
  const width = `${Math.max(8, magnitude * 100)}%`;
  const isHigh = feature.direction === "high";

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-zinc-700">
          {getFeatureDisplayLabel(feature)}
        </span>
        <span
          className={`font-mono text-xs font-semibold ${
            isHigh ? "text-[#173b35]" : "text-[#8a4b24]"
          }`}
        >
          {formatFeatureValue(feature.value)}
        </span>
      </div>
      <div className="grid grid-cols-[1fr_1fr] overflow-hidden border border-zinc-300 bg-[#f2f3ef]">
        <div className="flex justify-end border-r border-zinc-300">
          {!isHigh ? (
            <div className="h-2 bg-[#b88a2f]" style={{ width }} />
          ) : null}
        </div>
        <div>
          {isHigh ? <div className="h-2 bg-[#173b35]" style={{ width }} /> : null}
        </div>
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400">
        <span>low</span>
        <span>high</span>
      </div>
    </div>
  );
}

function SignalComparisonMatrix({ profiles }: { profiles: ClusterProfile[] }) {
  const allFeatures = profiles.flatMap((profile) => profile.distinguishingFeatures);
  const featureIds = [
    ...new Set(
      allFeatures.map((feature) => getClusterFeatureId(feature)),
    ),
  ].sort((a, b) => {
    const aFeature = allFeatures.find(
      (feature) => getClusterFeatureId(feature) === a,
    );
    const bFeature = allFeatures.find(
      (feature) => getClusterFeatureId(feature) === b,
    );

    if (!aFeature || !bFeature) return a.localeCompare(b);
    return sortFeaturesForComparison([aFeature, bFeature])[0] === aFeature
      ? -1
      : 1;
  });

  const featureByKey = new Map(
    allFeatures.map((feature) => [getClusterFeatureId(feature), feature]),
  );

  return (
    <WorkstationPanel className="mt-6 overflow-x-auto">
      <div className="border-b border-zinc-200 px-5 py-4">
        <h2 className="text-base font-semibold text-zinc-950">
          Signal comparison
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Compare cluster centroid values using the same feature order.
        </p>
      </div>
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-zinc-200 bg-[#f2f3ef] font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">
          <tr>
            <th className="py-2 pr-3 pl-5 font-medium">signal</th>
            {profiles.map((profile) => (
              <th
                key={profile.clusterId}
                className="px-3 py-2 text-right font-medium"
              >
                C{profile.clusterId}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {featureIds.map((featureId) => {
            const displayFeature = featureByKey.get(featureId);

            return (
              <tr key={featureId}>
                <td className="py-3 pr-3 pl-5 font-medium text-zinc-800">
                  {displayFeature
                    ? getFeatureDisplayLabel(displayFeature)
                    : featureId}
                </td>
                {profiles.map((profile) => {
                  const feature = profile.distinguishingFeatures.find(
                    (candidate) => getClusterFeatureId(candidate) === featureId,
                  );
                  const value = feature?.value ?? null;
                  const isHigh = value !== null && value >= 0;
                  const magnitude =
                    value === null ? 0 : Math.min(1, Math.abs(value) / 2.5);

                  return (
                    <td key={profile.clusterId} className="px-3 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-2 w-14 border border-zinc-300 bg-[#f2f3ef]">
                          <div
                            className={`h-full ${
                              isHigh ? "bg-[#173b35]" : "bg-[#b88a2f]"
                            }`}
                            style={{ width: `${Math.max(0, magnitude * 100)}%` }}
                          />
                        </div>
                        <span className="w-12 text-right font-mono text-xs text-zinc-700">
                          {value === null ? "-" : formatFeatureValue(value)}
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </WorkstationPanel>
  );
}

function CategoryMix({
  title,
  stats,
}: {
  title: string;
  stats: ClusterCategoryStat[];
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-zinc-950">{title}</h3>
      <div className="mt-3 grid gap-2">
        {stats.length > 0 ? (
          stats.map((stat) => (
            <div key={stat.name}>
              <div className="mb-1 flex items-center justify-between gap-3">
                <span className="truncate text-xs font-medium text-zinc-700">
                  {stat.name}
                </span>
                <span className="shrink-0 font-mono text-[11px] text-zinc-500">
                  {stat.count} / {formatPercent(stat.share)}
                </span>
              </div>
              <div className="h-2 border border-zinc-300 bg-[#f2f3ef]">
                <div
                  className="h-full bg-[#173b35]"
                  style={{ width: `${Math.max(3, stat.share * 100)}%` }}
                />
              </div>
            </div>
          ))
        ) : (
          <div className="border border-zinc-200 bg-[#f8f8f5] px-3 py-2 text-xs text-zinc-500">
            No classification data
          </div>
        )}
      </div>
    </div>
  );
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
  const candidateThresholds = isHamming
    ? overview.hammingThresholdCandidates
    : isIdfWeighted
      ? overview.idfWeightedJaccardThresholdCandidates
    : overview.thresholdCandidates;
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
  const maxFamilyCount = Math.max(...stats.map((stat) => stat.familyCount), 1);
  const maxComponentSize = Math.max(
    ...stats.map((stat) =>
      Math.max(stat.largestFamilySize, stat.secondLargestFamilySize),
    ),
    1,
  );
  const maxSecondMoment = Math.max(
    ...stats.map((stat) => stat.finiteClusterSecondMoment),
    1,
  );
  const points = stats.map((stat) => {
    const x = padding + stat.threshold * (width - padding * 2);
    const y =
      height -
      padding -
      (stat.familyCount / maxFamilyCount) * (height - padding * 2);

    return { ...stat, x, y };
  });
  const largestComponentPoints = stats.map((stat) => {
    const x = padding + stat.threshold * (width - padding * 2);
    const y =
      height -
      padding -
      (stat.largestFamilySize / maxComponentSize) * (height - padding * 2);

    return { ...stat, x, y };
  });
  const secondLargestComponentPoints = stats.map((stat) => {
    const x = padding + stat.threshold * (width - padding * 2);
    const y =
      height -
      padding -
      (stat.secondLargestFamilySize / maxComponentSize) *
        (height - padding * 2);

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
  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const largestComponentPath = largestComponentPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const secondLargestComponentPath = secondLargestComponentPoints
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
  const selectedThresholds = candidateThresholds.map((candidate) => {
    const stat =
      stats.find(
        (candidateStat) =>
          candidateStat.threshold.toFixed(2) ===
          candidate.threshold.toFixed(2),
      ) ?? stats[0];

    return {
      ...stat,
      label: candidate.label,
      key: `${candidate.kind}-${candidate.threshold.toFixed(2)}`,
    };
  });

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
            aria-label={`${title} family count chart`}
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
            {candidateThresholds.map((candidate) => {
              const x = padding + candidate.threshold * (width - padding * 2);

              return (
                <g key={candidate.kind}>
                  <line
                    x1={x}
                    y1={padding}
                    x2={x}
                    y2={height - padding}
                    stroke="#b88a2f"
                    strokeWidth="1.5"
                  />
                  <text
                    x={x + 4}
                    y={padding + 12}
                    className="fill-[#8a4b24] font-mono text-[10px]"
                  >
                    {candidate.threshold.toFixed(2)}
                  </text>
                </g>
              );
            })}
            <path
              d={path}
              fill="none"
              stroke="#173b35"
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <path
              d={largestComponentPath}
              fill="none"
              stroke="#8a4b24"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <path
              d={secondLargestComponentPath}
              fill="none"
              stroke="#6d5a2d"
              strokeWidth="2"
              strokeDasharray="5 4"
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
            {selectedThresholds.map((stat) => {
              const point = points.find(
                (candidate) => candidate.threshold === stat.threshold,
              );

              if (!point) return null;

              return (
                <g key={stat.key}>
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r="4"
                    fill="#b88a2f"
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                  <text
                    x={point.x}
                    y={Math.max(14, point.y - 8)}
                    textAnchor="middle"
                    className="fill-zinc-700 font-mono text-[10px]"
                  >
                    {stat.familyCount}
                  </text>
                </g>
              );
            })}
            <text
              x={padding}
              y={16}
              className="fill-zinc-500 font-mono text-[10px]"
            >
              count / component size / second moment
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
              family count
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-600">
              <span className="h-1.5 w-8 bg-[#8a4b24]" />
              largest component
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-600">
              <span className="h-0 w-8 border-t-2 border-dashed border-[#6d5a2d]" />
              second largest component
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
          <div className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            reference points
          </div>
          <div className="mt-3 grid gap-2">
            {selectedThresholds.map((stat) => (
              <div
                key={stat.key}
                className="grid grid-cols-[72px_1fr] gap-3 border border-zinc-200 bg-[#fbfaf5] px-3 py-2 text-sm"
              >
                <div className="font-mono font-semibold text-zinc-950">
                  {stat.threshold.toFixed(2)}
                </div>
                <div className="text-zinc-600">
                  <div className="font-medium text-zinc-950">{stat.label}</div>
                  <div>
                    <span className="font-semibold text-zinc-950">
                      {stat.familyCount}
                    </span>{" "}
                    families, largest {stat.largestFamilySize}, second{" "}
                    {stat.secondLargestFamilySize}, singleton{" "}
                    {stat.singletonFamilyCount}, second moment{" "}
                    {stat.finiteClusterSecondMoment.toFixed(0)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
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

  return (
    <WorkstationPanel className="mt-6 overflow-hidden">
      <div className="border-b border-zinc-200 px-5 py-4">
        <div className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
          community detection
        </div>
        <h2 className="mt-2 text-base font-semibold text-zinc-950">
          Signal similarity communities
        </h2>
        <p className="mt-1 text-sm leading-6 text-zinc-600">
          These models use the same sparse IDF-weighted signal similarity graph.
          The threshold charts above remain diagnostic; these communities are
          the first pass at market structure discovery.
        </p>
      </div>
      <div className="grid gap-0 lg:grid-cols-3">
        {analyses.map((analysis) => (
          <section
            key={analysis.method}
            className="border-b border-zinc-200 p-4 lg:border-r lg:border-b-0 lg:last:border-r-0"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-zinc-950">
                  {analysis.label}
                </h3>
                <p className="mt-1 text-xs leading-5 text-zinc-600">
                  {analysis.description}
                </p>
              </div>
              <div className="shrink-0 border border-zinc-200 bg-[#fbfaf5] px-2 py-1 text-right font-mono text-[11px] text-zinc-600">
                Q {formatNumber(analysis.modularity)}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
              <div className="border border-zinc-200 bg-white px-2 py-2">
                <div className="font-mono font-semibold text-zinc-950">
                  {analysis.communityCount}
                </div>
                <div className="text-zinc-500">communities</div>
              </div>
              <div className="border border-zinc-200 bg-white px-2 py-2">
                <div className="font-mono font-semibold text-zinc-950">
                  {analysis.largestCommunitySize}
                </div>
                <div className="text-zinc-500">largest</div>
              </div>
              <div className="border border-zinc-200 bg-white px-2 py-2">
                <div className="font-mono font-semibold text-zinc-950">
                  {analysis.singletonCommunityCount}
                </div>
                <div className="text-zinc-500">singletons</div>
              </div>
            </div>

            <div className="mt-3 font-mono text-[11px] leading-5 text-zinc-500">
              {analysis.graphSource}
              <br />
              {analysis.nodeCount} nodes / {analysis.edgeCount} edges
            </div>

            <div className="mt-4 grid gap-3">
              {(analysis.communities ?? []).slice(0, 4).map((community) => (
                <div
                  key={`${analysis.method}-${community.communityId}`}
                  className="border border-zinc-200 bg-[#fbfaf5] p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                        Community {community.communityId}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-zinc-950">
                        {community.groupCount} groups / {community.tickerCount}{" "}
                        tickers
                      </div>
                    </div>
                    <div className="shrink-0 text-right font-mono text-[11px] text-zinc-600">
                      density {formatPercent(community.edgeDensity)}
                      <br />
                      weight {community.internalEdgeWeight.toFixed(1)}
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2">
                    {(community.topSignals ?? []).slice(0, 4).map((signalSummary) => (
                      <div
                        key={`${analysis.method}-${community.communityId}-${signalSummary.signal.token}`}
                      >
                        <div className="mb-1 flex items-start justify-between gap-2 text-xs">
                          <span className="min-w-0 break-words font-medium text-zinc-700">
                            {signalSummary.signal.token}
                          </span>
                          <span className="shrink-0 font-mono text-[11px] text-zinc-600">
                            {formatPercent(signalSummary.share)}
                          </span>
                        </div>
                        <div className="h-1.5 border border-zinc-300 bg-white">
                          <div
                            className="h-full bg-[#173b35]"
                            style={{
                              width: `${Math.max(3, signalSummary.share * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 grid gap-1 border-t border-zinc-200 pt-3">
                    {(community.topMembers ?? []).map((member) => (
                      <div
                        key={`${analysis.method}-${community.communityId}-${member.ticker}`}
                        className="flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <span className="font-mono font-semibold text-zinc-950">
                            {member.ticker}
                          </span>{" "}
                          <span className="truncate text-zinc-600">
                            {member.companyName ?? "Unknown company"}
                          </span>
                        </div>
                        <div className="shrink-0 font-mono text-[11px] text-zinc-600">
                          {formatMarketCap(member.marketCap)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </WorkstationPanel>
  );
}

function SignalCombinationOverviewView({
  overview,
  viewMode,
  onChangeViewMode,
}: {
  overview: TickerSignalCombinationOverview;
  viewMode: "market" | "factor";
  onChangeViewMode: (nextViewMode: "market" | "factor") => void;
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
        <div className="grid gap-0 lg:grid-cols-[280px_1fr]">
          <div className="border-b border-zinc-200 bg-[#f2f3ef] p-4 lg:border-r lg:border-b-0">
            <div className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              market view
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-1">
              {[
                ["market", "Signal combinations"],
                ["factor", "Factor cohorts"],
              ].map(([mode, label]) => {
                const isSelected = viewMode === mode;

                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => onChangeViewMode(mode as "market" | "factor")}
                    className={`border px-3 py-2 text-left text-xs font-semibold transition ${
                      isSelected
                        ? "border-zinc-950 bg-[#173b35] text-white shadow-[3px_3px_0_0_rgba(24,24,27,0.16)]"
                        : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-950 hover:bg-[#fbfaf5]"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
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
        </div>
      </WorkstationPanel>

      {overview.unavailableReason ? (
        <section className="mt-6 border border-[#b88a2f] bg-[#fff8df] p-5 font-mono text-xs leading-6 text-[#6d3f13] shadow-[4px_4px_0_0_rgba(184,138,47,0.16)]">
          {overview.unavailableReason}
        </section>
      ) : null}

      {overview.groups.length === 0 ? (
        <WorkstationPanel className="mt-6 p-6">
          <h2 className="text-lg font-semibold text-zinc-950">
            No signal combination groups yet
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Run the factor signal workflow first, then this page can group
            tickers by their current selected signal set.
          </p>
        </WorkstationPanel>
      ) : (
        <>
          <ThresholdFamilyChart
            overview={overview}
            lens="idfWeightedJaccard"
          />
          <ThresholdFamilyChart overview={overview} lens="hamming" />
          <CommunityDetectionSection overview={overview} />
        </>
      )}
    </>
  );
}

export function MarketClusterOverview() {
  const [viewMode, setViewMode] = useState<"market" | "factor">("market");
  const [overview, setOverview] =
    useState<TickerFactorMetricClusterOverview | null>(null);
  const [signalCombinationOverview, setSignalCombinationOverview] =
    useState<TickerSignalCombinationOverview | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (viewMode === "market") {
      fetchSignalCombinationOverview()
        .then((nextOverview) => {
          if (!isMounted) return;
          setSignalCombinationOverview(nextOverview);
          setOverview(null);
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
    }

    fetchMarketClusterOverview({
      runId: selectedRunId ?? undefined,
      normalizationMethod: "none",
      vectorMode: "factor_signal",
      vectorSourcePolicy: "signal_activation",
      runScope: "single",
    })
      .then((nextOverview) => {
        if (!isMounted) return;
        setOverview(nextOverview);
        setSignalCombinationOverview(null);
        setErrorMessage(null);
        if (!selectedRunId && nextOverview.latestRun) {
          setSelectedRunId(nextOverview.latestRun.runId);
        }
      })
      .catch((error) => {
        if (!isMounted) return;
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to fetch market cluster overview.",
        );
      });

    return () => {
      isMounted = false;
    };
  }, [selectedRunId, viewMode]);

  if (errorMessage) {
    return (
      <MarketClusterOverviewShell>
        <WorkstationPanel className="p-6">
          <h1 className="text-lg font-semibold text-zinc-950">
            Failed to load the clustering overview
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            {errorMessage}
          </p>
        </WorkstationPanel>
      </MarketClusterOverviewShell>
    );
  }

  if (
    (viewMode === "market" && !signalCombinationOverview) ||
    (viewMode === "factor" && !overview)
  ) {
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

  if (viewMode === "market" && signalCombinationOverview) {
    const changeViewMode = (nextViewMode: "market" | "factor") => {
      if (nextViewMode === viewMode) return;
      setViewMode(nextViewMode);
      setSelectedRunId(null);
      setOverview(null);
      setSignalCombinationOverview(null);
      setErrorMessage(null);
    };

    return (
      <MarketClusterOverviewShell>
        <SignalCombinationOverviewView
          overview={signalCombinationOverview}
          viewMode={viewMode}
          onChangeViewMode={changeViewMode}
        />
      </MarketClusterOverviewShell>
    );
  }

  if (!overview) return null;

  const tickersByCluster = new Map(
    overview.profiles.map((profile) => [
      profile.clusterId,
      overview.clusters
        .filter((cluster) => cluster.clusterId === profile.clusterId)
        .sort(
          (a, b) =>
            (b.marketCap ?? -1) - (a.marketCap ?? -1) ||
            a.ticker.localeCompare(b.ticker),
        )
        .slice(0, 6),
    ]),
  );
  const dimensionLabel = formatDimensionLabel(overview);
  const latestRun = overview.latestRun;
  const latestRunIsCombined = latestRun
    ? isCombinedScope(latestRun.factor, latestRun.axis)
    : viewMode === "market";
  const signalCohortView = viewMode === "factor" && !latestRunIsCombined;
  const groupLabel = signalCohortView ? "cohorts" : "clusters";
  const viewTitle =
    viewMode === "market" ? "Market archetype clusters" : "Factor signal cohorts";
  const viewDescription =
    viewMode === "market"
      ? "Cross-factor signal activation vectors grouped into market-wide company archetypes."
      : "Single factor-axis signal activation vectors grouped into focused cohorts.";
  const changeViewMode = (nextViewMode: "market" | "factor") => {
    if (nextViewMode === viewMode) return;
    setViewMode(nextViewMode);
    setSelectedRunId(null);
    setOverview(null);
    setErrorMessage(null);
  };

  return (
    <MarketClusterOverviewShell>
      <section className="border-b border-zinc-300 pb-7">
        <div className="font-mono text-xs font-semibold uppercase tracking-[0.24em] text-[#6d5a2d]">
          Market Cluster Overview
        </div>
        <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 md:text-4xl">
              {viewTitle}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
              {viewDescription}
            </p>
          </div>
          {latestRun ? (
            <div className="grid min-w-full grid-cols-3 border border-zinc-950 bg-white text-right shadow-[4px_4px_0_0_rgba(24,24,27,0.12)] sm:min-w-[360px]">
              <div className="border-r border-zinc-200 px-3 py-3">
                <div className="text-2xl font-semibold text-zinc-950">
                  {latestRun.tickerCount}
                </div>
                <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                  tickers
                </div>
              </div>
              <div className="border-r border-zinc-200 px-3 py-3">
                <div className="text-2xl font-semibold text-zinc-950">
                  {latestRun.featureCount}
                </div>
                <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                  {dimensionLabel}
                </div>
              </div>
              <div className="px-3 py-3">
                <div className="text-2xl font-semibold text-zinc-950">
                  {latestRun.clusterCount}
                </div>
                <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                  {groupLabel}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <WorkstationPanel className="mt-6 overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[280px_1fr]">
          <div className="border-b border-zinc-200 bg-[#f2f3ef] p-4 lg:border-r lg:border-b-0">
            <div className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              clustering view
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-1">
              {[
                ["market", "Market archetypes"],
                ["factor", "Factor cohorts"],
              ].map(([mode, label]) => {
                const isSelected = viewMode === mode;

                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => changeViewMode(mode as "market" | "factor")}
                    className={`border px-3 py-2 text-left text-xs font-semibold transition ${
                      isSelected
                        ? "border-zinc-950 bg-[#173b35] text-white shadow-[3px_3px_0_0_rgba(24,24,27,0.16)]"
                        : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-950 hover:bg-[#fbfaf5]"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid gap-0 text-sm md:grid-cols-3">
            <div className="border-b border-zinc-200 p-4 md:border-r md:border-b-0">
              <div className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">
                run shape
              </div>
              <div className="mt-1 font-medium text-zinc-950">
                {latestRun
                  ? latestRunIsCombined
                    ? "cross-factor"
                    : "single factor-axis"
                  : "-"}
              </div>
            </div>
            <div className="border-b border-zinc-200 p-4 md:border-r md:border-b-0">
              <div className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">
                vector source
              </div>
              <div className="mt-1 font-medium text-zinc-950">
                {latestRun?.vectorMode ?? "factor_signal"} /{" "}
                {latestRun?.vectorSourcePolicy ?? "signal_activation"}
              </div>
            </div>
            <div className="p-4">
              <div className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">
                current scope
              </div>
              <div className="mt-1 break-words font-medium text-zinc-950">
                {latestRun
                  ? formatScopeSummary(latestRun.factor, latestRun.axis)
                  : viewMode === "market"
                    ? "No market run"
                    : "No factor run"}
              </div>
            </div>
          </div>
        </div>
      </WorkstationPanel>

        {overview.availableRuns.length > 0 ? (
          <WorkstationPanel className="mt-6 overflow-hidden">
            <div className="border-b border-zinc-200 px-5 py-4">
              <h2 className="text-base font-semibold text-zinc-950">
                {viewMode === "market" ? "Market runs" : "Factor scopes"}
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                {viewMode === "market"
                  ? "Combined runs cluster companies across all available factor signal dimensions."
                  : "Each scope is clustered separately from factor signal activation vectors."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 p-4">
              {overview.availableRuns.map((run) => {
                const isSelected =
                  run.runId === (overview.latestRun?.runId ?? selectedRunId);

                return (
                  <button
                    key={run.runId}
                    type="button"
                    onClick={() => setSelectedRunId(run.runId)}
                    className={`border px-3 py-2 text-left text-xs transition ${
                      isSelected
                        ? "border-zinc-950 bg-[#173b35] text-white shadow-[3px_3px_0_0_rgba(24,24,27,0.16)]"
                        : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-950 hover:bg-[#fbfaf5]"
                    }`}
                  >
                    <div className="font-mono font-semibold uppercase tracking-[0.12em]">
                      {formatScopeSummary(run.factor, run.axis)}
                    </div>
                    <div
                      className={`mt-1 ${
                        isSelected ? "text-white/70" : "text-zinc-500"
                      }`}
                    >
                      {run.featureCount}{" "}
                      {run.vectorMode === "factor_signal" ? "signals" : "features"} /{" "}
                      {run.clusterCount}{" "}
                      {viewMode === "factor" ? "cohorts" : "clusters"}
                    </div>
                    {isCombinedScope(run.factor, run.axis) ? (
                      <div
                        className={`mt-1 max-w-[280px] truncate ${
                          isSelected ? "text-white/60" : "text-zinc-400"
                        }`}
                      >
                        {formatScopeDetail(run.factor, run.axis)}
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </WorkstationPanel>
        ) : null}

        {overview.unavailableReason ? (
          <section className="mt-6 border border-[#b88a2f] bg-[#fff8df] p-5 font-mono text-xs leading-6 text-[#6d3f13] shadow-[4px_4px_0_0_rgba(184,138,47,0.16)]">
            {overview.unavailableReason}
          </section>
        ) : null}

        {!overview.latestRun ? (
          <WorkstationPanel className="mt-6 p-6">
            <h2 className="text-lg font-semibold text-zinc-950">
              {viewMode === "market"
                ? "No market archetype run yet"
                : "No factor cohort runs yet"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              {viewMode === "market"
                ? "Run clustering with multiple factor-axis targets to show a cross-factor market view here."
                : "Run the `factor_metric_clustering` job or the internal clustering API to show the latest factor scope here."}
            </p>
          </WorkstationPanel>
        ) : (
          <>
            <WorkstationPanel className="mt-6 grid gap-0 text-sm md:grid-cols-2 xl:grid-cols-4">
              <div className="border-b border-zinc-200 p-4 md:border-r xl:border-b-0">
                <div className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">
                  scope
                </div>
                <div className="mt-1 break-words font-medium text-zinc-950">
                  {formatScopeSummary(
                    overview.latestRun.factor,
                    overview.latestRun.axis,
                  )}
                </div>
                {isCombinedScope(
                  overview.latestRun.factor,
                  overview.latestRun.axis,
                ) ? (
                  <div className="mt-1 break-words text-xs leading-5 text-zinc-500">
                    {formatScopeDetail(
                      overview.latestRun.factor,
                      overview.latestRun.axis,
                    )}
                  </div>
                ) : null}
              </div>
              <div className="border-b border-zinc-200 p-4 xl:border-r xl:border-b-0">
                <div className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">
                  comparison
                </div>
                <div className="mt-1 break-words font-medium text-zinc-950">
                  {overview.latestRun.comparisonSetType}/
                  {overview.latestRun.comparisonSetKey}
                </div>
              </div>
              <div className="border-b border-zinc-200 p-4 md:border-r md:border-b-0">
                <div className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">
                  method
                </div>
                <div className="mt-1 break-words font-medium text-zinc-950">
                  {overview.latestRun.normalizationMethod} +{" "}
                  {overview.latestRun.clusterMethod}
                </div>
                <div className="mt-1 break-words font-mono text-[11px] text-zinc-500">
                  {overview.latestRun.vectorMode ?? "vector"} /{" "}
                  {overview.latestRun.vectorSourcePolicy ?? "source"}
                </div>
              </div>
              <div className="p-4">
                <div className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">
                  computed
                </div>
                <div className="mt-1 break-words font-medium text-zinc-950">
                  {overview.latestRun.computedAt}
                </div>
              </div>
            </WorkstationPanel>

            <SignalComparisonMatrix profiles={overview.profiles} />

            <section className="mt-6 grid gap-4 lg:grid-cols-2">
              {overview.profiles.map((profile) => {
                const tickerRows = tickersByCluster.get(profile.clusterId) ?? [];
                const profileDisplay = buildProfileDisplay(profile);

                return (
                  <article
                    key={profile.clusterId}
                    className="border border-zinc-300 bg-white shadow-[4px_4px_0_0_rgba(24,24,27,0.08)]"
                  >
                    <div className="flex items-start justify-between gap-4 border-b border-zinc-200 bg-[#f2f3ef] px-5 py-4">
                      <div>
                        <div className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#6d5a2d]">
                          {signalCohortView ? "Cohort" : "Cluster"}{" "}
                          {profile.clusterId}
                        </div>
                        <h2 className="mt-2 text-lg font-semibold text-zinc-950">
                          {profileDisplay.title}
                        </h2>
                        <p className="mt-1 max-w-xl text-sm leading-5 text-zinc-600">
                          {profileDisplay.summary}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-semibold text-zinc-950">
                          {profile.clusterSize}
                        </div>
                        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                          companies
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-0 border-b border-zinc-100 text-sm sm:grid-cols-3">
                      <div>
                        <div className="border-b border-zinc-100 px-5 py-3 sm:border-r sm:border-b-0">
                          <div className="text-xs text-zinc-500">coverage</div>
                          <div className="font-medium text-zinc-950">
                            {formatPercent(profile.averageCoverageRatio)}
                          </div>
                        </div>
                      </div>
                      <div>
                        <div className="border-b border-zinc-100 px-5 py-3 sm:border-r sm:border-b-0">
                          <div className="text-xs text-zinc-500">distance</div>
                          <div className="font-medium text-zinc-950">
                            {formatNumber(profile.averageDistanceToCentroid)}
                          </div>
                        </div>
                      </div>
                      <div className="px-5 py-3">
                        <div className="text-xs text-zinc-500">
                          {dimensionLabel}
                        </div>
                        <div className="font-medium text-zinc-950">
                          {profile.featureCount}
                        </div>
                      </div>
                    </div>

                    <div className="px-5 py-4">
                      <h3 className="text-sm font-semibold text-zinc-950">
                        Signal profile
                      </h3>
                      <div className="mt-3 grid gap-3">
                        {getSignalProfileFeatures(profile, signalCohortView).map((feature) => (
                          <SignalFeatureBar
                            key={getClusterFeatureId(feature)}
                            feature={feature}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-5 border-t border-zinc-200 px-5 py-4 md:grid-cols-2">
                      <CategoryMix title="Sector mix" stats={profile.sectorStats} />
                      <CategoryMix
                        title="Industry mix"
                        stats={profile.industryStats}
                      />
                    </div>

                    <div className="overflow-x-auto border-t border-zinc-200">
                      <div className="flex flex-col gap-1 border-b border-zinc-200 bg-[#fbfaf5] px-5 py-3 sm:flex-row sm:items-end sm:justify-between">
                        <h3 className="text-sm font-semibold text-zinc-950">
                          Largest companies
                        </h3>
                        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-zinc-500">
                          sorted by market cap
                        </p>
                      </div>
                      <table className="w-full min-w-[520px] text-left text-sm">
                        <thead className="border-b border-zinc-200 bg-[#f2f3ef] font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">
                          <tr>
                            <th className="py-2 pr-3 pl-5 font-medium">ticker</th>
                            <th className="py-2 pr-3 font-medium">company</th>
                            <th className="py-2 pr-3 font-medium">sector</th>
                            <th className="py-2 pr-5 text-right font-medium">
                              market cap
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {tickerRows.map((ticker) => (
                            <tr key={ticker.ticker} className="hover:bg-[#fbfaf5]">
                              <td className="py-2 pr-3 pl-5 font-semibold text-zinc-950">
                                <Link
                                  href={`/tickers/${ticker.ticker}`}
                                  className="underline decoration-[#b88a2f] underline-offset-4 hover:text-[#173b35]"
                                >
                                  {ticker.ticker}
                                </Link>
                              </td>
                              <td className="py-2 pr-3 text-zinc-700">
                                {ticker.companyName ?? "-"}
                              </td>
                              <td className="py-2 pr-3 text-zinc-600">
                                {ticker.sector ?? "-"}
                              </td>
                              <td className="py-2 pr-5 text-right font-mono text-zinc-700">
                                {formatMarketCap(ticker.marketCap)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </article>
                );
              })}
            </section>
          </>
        )}
    </MarketClusterOverviewShell>
  );
}

function MarketClusterOverviewShell({ children }: { children: ReactNode }) {
  return (
    <WorkstationFrame
      title="market signal workstation"
      backHref="/dashboard"
      backLabel="Dashboard"
      maxWidthClassName="max-w-7xl"
    >
      {children}
    </WorkstationFrame>
  );
}
