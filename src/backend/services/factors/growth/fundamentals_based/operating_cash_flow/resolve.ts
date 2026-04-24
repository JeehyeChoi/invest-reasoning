import {
  resolveFlowMetricSeries,
  type FlowMetricSeriesPoint,
} from "@/backend/services/factors/growth/fundamentals_based/resolveFlowMetricSeries";

export type OperatingCashFlowSeriesPoint = FlowMetricSeriesPoint;

type ResolveOperatingCashFlowSeriesInput = {
  cik: string;
};

export async function resolve({
  cik,
}: ResolveOperatingCashFlowSeriesInput): Promise<OperatingCashFlowSeriesPoint[]> {
  return resolveFlowMetricSeries({
    cik,
    metricKey: "operating_cash_flow",
  });
}
