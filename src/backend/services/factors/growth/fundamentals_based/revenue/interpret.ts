import type { RevenueGrowthMetrics } from "@/backend/schemas/factors/growth";

export function interpret(
  metrics: RevenueGrowthMetrics | null,
): string | null {
  if (!metrics) return null;

  const { yoy, qoq, consistency, acceleration } = metrics;

  const yoyVal = yoy ?? 0;
  const qoqVal = qoq ?? 0;
  const consistencyVal = consistency ?? 0;
  const accelVal = acceleration ?? 0;

  // Strong accelerating growth
  if (
    yoyVal > 0.2 &&
    qoqVal > 0 &&
    consistencyVal >= 0.75 &&
    accelVal > 0
  ) {
    return "Strong and accelerating growth signal.";
  }

  // Stable but slowing
  if (
    yoyVal > 0 &&
    consistencyVal >= 0.75 &&
    accelVal <= 0
  ) {
    return "Stable growth with slowing momentum.";
  }

  // Weak growth
  if (yoyVal <= 0) {
    return "Weak or negative year-over-year growth.";
  }

  // Mixed case
  return "Mixed growth signal.";
}
