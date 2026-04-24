import {
  computeSeriesGrowth,
  type SeriesGrowthConfig,
  type SeriesPoint,
} from "@/backend/services/factors/growth/fundamentals_based/computeSeriesGrowth";
import type { GrowthMetricSignalsExtended } from "@/backend/schemas/factors/growth";

export type CapexGrowthConfig = SeriesGrowthConfig;
export type CapexPoint = SeriesPoint;

export function compute(
  series: CapexPoint[],
  config: CapexGrowthConfig,
): GrowthMetricSignalsExtended | null {
  const mode = config.compute?.mode ?? "basic";

  return computeSeriesGrowth(series, config, mode) as
    | GrowthMetricSignalsExtended
    | null;
}
