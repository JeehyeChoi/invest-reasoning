import type { GrowthMetricSignalsExtended } from "@/backend/schemas/factors/growth";
import type { SecMetricKey } from "@/backend/schemas/sec/metrics";

export function interpretGrowthMetrics(
  metrics: GrowthMetricSignalsExtended | null,
  metricKey?: SecMetricKey,
): string | null {
  if (!metrics) return null;

  const {
    yoy,
    qoq,
    consistency,
    acceleration,
    turnaround,
    lossNarrowing,
    deterioration,
  } = metrics;

  const yoyVal = yoy ?? 0;
  const qoqVal = qoq ?? 0;
  const consistencyVal = consistency ?? 0;
  const accelVal = acceleration ?? 0;

  if (metricKey === "capex") {
    if (yoyVal > 0.2) {
      return "Capital investment is increasing, suggesting higher reinvestment intensity.";
    }

    if (yoyVal < -0.2) {
      return "Capital investment is declining, suggesting lower reinvestment intensity.";
    }

    return "Capital investment is relatively stable.";
  }

  if (metricKey === "operating_cash_flow") {
    if (yoyVal > 0.1 && consistencyVal >= 0.75) {
      return "Operating cash flow is improving with consistent cash generation.";
    }

    if (yoyVal <= 0) {
      return "Operating cash flow is weak or declining.";
    }

    return "Operating cash flow growth is mixed.";
  }

  if (turnaround) {
    return "Turnaround signal with improving profitability.";
  }

  if (deterioration) {
    return "Profitability deterioration signal.";
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

  if (yoyVal > 0 && consistencyVal >= 0.75 && accelVal <= 0) {
    return "Stable growth with slowing momentum.";
  }

  if (yoyVal <= 0) {
    return "Weak or negative year-over-year growth.";
  }

  return "Mixed growth signal.";
}
