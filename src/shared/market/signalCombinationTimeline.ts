import type {
  TickerSignalCombinationBridgeSignalSummary,
  TickerSignalCombinationFamilySignalSummary,
} from "@/shared/market/signalCombinationOverview";

export const SIGNAL_TIMELINE_AXIS_SCOPES = [
  "all",
  "fundamentals",
  "price_linked",
] as const;

export type SignalTimelineAxisScope =
  (typeof SIGNAL_TIMELINE_AXIS_SCOPES)[number];

export function normalizeSignalTimelineAxisScope(
  value: string | null | undefined,
) {
  return SIGNAL_TIMELINE_AXIS_SCOPES.includes(value as SignalTimelineAxisScope)
    ? (value as SignalTimelineAxisScope)
    : undefined;
}

export type SignalTimelineAxisScopeOption = {
  key: SignalTimelineAxisScope;
  label: string;
  description: string;
  axes: string[] | null;
};

export const SIGNAL_TIMELINE_AXIS_SCOPE_OPTIONS = [
  {
    key: "all",
    label: "All axes",
    description: "All signal axes in one market network.",
    axes: null,
  },
  {
    key: "fundamentals",
    label: "Fundamentals",
    description: "SEC-derived company operating signals only.",
    axes: ["fundamentals_based"],
  },
  {
    key: "price_linked",
    label: "Price-linked",
    description: "Market price and ETF co-movement signals.",
    axes: ["market_price", "etf_exposure"],
  },
] satisfies SignalTimelineAxisScopeOption[];

export type TickerSignalCombinationTimelinePiece = {
  familyId: number;
  groupCount: number;
  tickerCount: number;
  topSignals: TickerSignalCombinationFamilySignalSummary[];
};

export type TickerSignalCombinationTimelineAnalysis = {
  lens: "idfWeightedJaccard";
  label: string;
  previousThreshold: number;
  peakThreshold: number;
  peakMoment: number;
  largestBeforeSize: number;
  largestBeforeTickerCount?: number;
  largestAfterPieceCount: number;
  largestAfterSize: number;
  largestAfterTickerCount?: number;
  removedEdgeCount: number;
  bridgeEdgeCount: number;
};

export type TickerSignalCombinationTimelineSnapshot = {
  asOfDate: string;
  label: string;
  tickerCount: number;
  groupCount: number;
  signalDimensionCount: number;
  analysis: TickerSignalCombinationTimelineAnalysis | null;
  splitAnalyses?: TickerSignalCombinationTimelineAnalysis[];
  splitViews?: Array<{
    analysis: TickerSignalCombinationTimelineAnalysis;
    baselineSignals: TickerSignalCombinationFamilySignalSummary[];
    boundarySignals: TickerSignalCombinationBridgeSignalSummary[];
    largestPieces: TickerSignalCombinationTimelinePiece[];
  }>;
  baselineSignals: TickerSignalCombinationFamilySignalSummary[];
  boundarySignals: TickerSignalCombinationBridgeSignalSummary[];
  largestPieces: TickerSignalCombinationTimelinePiece[];
};

export type TickerSignalCombinationTimelineOverview = {
  generatedAt: string;
  years: number;
  frequency: "year_end" | "year_end_plus_recent_quarters" | "quarter_end";
  lens: "idfWeightedJaccard";
  axisScope: SignalTimelineAxisScope;
  snapshots: TickerSignalCombinationTimelineSnapshot[];
  unavailableReason?: string;
};
