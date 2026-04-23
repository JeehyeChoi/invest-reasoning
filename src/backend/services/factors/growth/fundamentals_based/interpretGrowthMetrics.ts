import type { GrowthMetricSignalsExtended } from "@/backend/schemas/factors/growth";

export function interpretGrowthMetrics(
  metrics: GrowthMetricSignalsExtended | null,
): string | null {
  if (!metrics) return null;

  const { yoy, qoq, consistency, acceleration, turnaround, lossNarrowing } = metrics;

  const yoyVal = yoy ?? 0;
  const qoqVal = qoq ?? 0;
  const consistencyVal = consistency ?? 0;
  const accelVal = acceleration ?? 0;

  if (turnaround) {
    return "Turnaround signal with improving profitability.";
  }

  if (lossNarrowing) {
    return "Losses are narrowing, suggesting improving earnings momentum.";
  }

  if (
    yoyVal > 0.2 &&
    qoqVal > 0 &&
    consistencyVal >= 0.75 &&
    accelVal > 0
  ) {
    return "Strong and accelerating growth signal.";
  }

  if (
    yoyVal > 0 &&
    consistencyVal >= 0.75 &&
    accelVal <= 0
  ) {
    return "Stable growth with slowing momentum.";
  }

  if (yoyVal <= 0) {
    return "Weak or negative year-over-year growth.";
  }

  return "Mixed growth signal.";
}
