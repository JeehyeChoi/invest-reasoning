import type {
  SignalTimelineAxisScope,
  TickerSignalCombinationTimelineOverview,
} from "@/shared/market/signalCombinationTimeline";

export type FetchSignalCombinationTimelineInput = {
  years?: number;
  includeLatest?: boolean;
  refresh?: boolean;
  axisScope?: SignalTimelineAxisScope;
};

export async function fetchSignalCombinationTimeline(
  input: FetchSignalCombinationTimelineInput = {},
): Promise<TickerSignalCombinationTimelineOverview> {
  const params = new URLSearchParams();
  if (input.years) params.set("years", String(input.years));
  if (input.includeLatest === false) params.set("includeLatest", "false");
  if (input.refresh) params.set("refresh", "true");
  if (input.axisScope) params.set("axisScope", input.axisScope);

  const query = params.toString();
  const response = await fetch(
    `/api/market/signal-combinations/timeline${query ? `?${query}` : ""}`,
  );

  if (!response.ok) {
    throw new Error("Failed to fetch signal combination timeline.");
  }

  return response.json();
}
