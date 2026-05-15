import type { TickerSignalCombinationOverview } from "@/shared/market/signalCombinationOverview";
import type { SignalTimelineAxisScope } from "@/shared/market/signalCombinationTimeline";

export type FetchSignalCombinationOverviewInput = {
  asOfDate?: string;
  axisScope?: SignalTimelineAxisScope;
};

export async function fetchSignalCombinationOverview(
  input: FetchSignalCombinationOverviewInput = {},
): Promise<TickerSignalCombinationOverview> {
  const params = new URLSearchParams();
  if (input.asOfDate) params.set("asOfDate", input.asOfDate);
  if (input.axisScope) params.set("axisScope", input.axisScope);

  const query = params.toString();
  const response = await fetch(
    `/api/market/signal-combinations/overview${query ? `?${query}` : ""}`,
  );

  if (!response.ok) {
    throw new Error("Failed to fetch signal combination overview.");
  }

  return response.json();
}
