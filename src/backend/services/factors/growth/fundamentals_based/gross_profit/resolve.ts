import {
  resolveFlowMetricSeries,
  type FlowMetricSeriesPoint,
} from "@/backend/services/factors/growth/fundamentals_based/resolveFlowMetricSeries";

export type GrossProfitSeriesPoint = FlowMetricSeriesPoint;

type ResolveGrossProfitSeriesInput = {
  cik: string;
};

export async function resolve({
  cik,
}: ResolveGrossProfitSeriesInput): Promise<GrossProfitSeriesPoint[]> {
  return resolveFlowMetricSeries({
    cik,
    metricKey: "gross_profit",
  });
}
