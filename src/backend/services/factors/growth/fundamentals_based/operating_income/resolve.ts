import {
  resolveFlowMetricSeries,
  type FlowMetricSeriesPoint,
} from "@/backend/services/factors/growth/fundamentals_based/resolveFlowMetricSeries";

export type OperatingIncomeSeriesPoint = FlowMetricSeriesPoint;

type ResolveOperatingIncomeSeriesInput = {
  cik: string;
};

export async function resolve({
  cik,
}: ResolveOperatingIncomeSeriesInput): Promise<OperatingIncomeSeriesPoint[]> {
  return resolveFlowMetricSeries({
    cik,
    metricKey: "operating_income",
  });
}
