import {
  computeSeriesGrowth,
  type SeriesGrowthConfig,
  type SeriesPoint,
} from "@/backend/services/factors/growth/fundamentals_based/computeSeriesGrowth";
import type { GrowthMetricSignalsExtended } from "@/backend/schemas/factors/growth";

export type OperatingCashFlowGrowthConfig = SeriesGrowthConfig;
export type OperatingCashFlowPoint = SeriesPoint;

export function compute(
  series: OperatingCashFlowPoint[],
  config: OperatingCashFlowGrowthConfig,
): GrowthMetricSignalsExtended | null {
  const mode = config.compute?.mode ?? "basic";

  return computeSeriesGrowth(series, config, mode) as
    | GrowthMetricSignalsExtended
    | null;
}
