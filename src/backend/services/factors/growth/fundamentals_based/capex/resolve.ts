import {
  resolveFlowMetricSeries,
  type FlowMetricSeriesPoint,
} from "@/backend/services/factors/growth/fundamentals_based/resolveFlowMetricSeries";

export type CapexSeriesPoint = FlowMetricSeriesPoint;

type ResolveCapexSeriesInput = {
  cik: string;
};

export async function resolve({
  cik,
}: ResolveCapexSeriesInput): Promise<CapexSeriesPoint[]> {
  return resolveFlowMetricSeries({
    cik,
    metricKey: "capex",
  });
}
