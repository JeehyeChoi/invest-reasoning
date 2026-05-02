import type { SecMetricKey } from "@/shared/sec/metrics";

type GrowthHeadlineInterpretationInput = {
  metricKey: SecMetricKey;
  latestGrowthValue: number | null;
  durableGrowthValue: number | null;
  consistencyValue: number | null;
  coverageValue: number | null;
  accelerationValue: number | null;
  trendDeviationValue: number | null;
  dataQualityLevel: string | null;
  usPublicEquitiesPercentile: number | null;
  usPublicEquitiesDistanceToMedian: number | null;
  sectorPercentile: number | null;
};

export type GrowthHeadlineInterpretation = {
  label: string;
  summary: string;
};

export function deriveTickerFactorMetricGrowthHeadlineInterpretation(
  input: GrowthHeadlineInterpretationInput,
): GrowthHeadlineInterpretation {
  if (input.coverageValue != null && input.coverageValue < 0.5) {
    return {
      label: "Low-confidence signal",
      summary:
        "Recent history is too sparse to read the growth pattern with confidence.",
    };
  }

  if (
    input.latestGrowthValue == null &&
    input.durableGrowthValue == null &&
    input.consistencyValue == null
  ) {
    return {
      label: "No growth read",
      summary: "Available signals are not sufficient for a growth interpretation.",
    };
  }

  const base = isInvestmentMetric(input.metricKey)
    ? deriveInvestmentGrowthInterpretation(input)
    : deriveOperatingGrowthInterpretation(input);

  return {
    label: base.label,
    summary: appendContext(base.summary, input),
  };
}

function deriveOperatingGrowthInterpretation(
  input: GrowthHeadlineInterpretationInput,
): GrowthHeadlineInterpretation {
  const latest = input.latestGrowthValue;
  const durable = input.durableGrowthValue;
  const consistency = input.consistencyValue;
  const acceleration = input.accelerationValue;

  if (isPositive(durable, 0.1) && isPositive(consistency, 0.75)) {
    if (isPositive(acceleration, 0.02)) {
      return {
        label: "Accelerating growth",
        summary:
          "Growth is durable across recent quarters and the YoY pace is improving.",
      };
    }

    if (isNegative(acceleration, -0.05)) {
      return {
        label: "Durable growth, cooling",
        summary:
          "The company is still growing on a durable basis, but momentum has softened.",
      };
    }

    return {
      label: "Durable growth",
      summary:
        "The metric is growing on both recent and trailing-twelve-month signals.",
    };
  }

  if (isPositive(latest, 0.1) && !isPositive(durable, 0.05)) {
    return {
      label: "Tentative growth",
      summary:
        "The latest YoY signal is positive, but durable growth has not confirmed it yet.",
    };
  }

  if (isNegative(latest, -0.05) && isNegative(durable, -0.05)) {
    return {
      label: "Contracting",
      summary: "Both recent and durable growth signals point to contraction.",
    };
  }

  if (isNearFlat(latest) && isNearFlat(durable)) {
    return {
      label: "Mostly stable",
      summary:
        "Growth signals are close to flat rather than clearly expanding or contracting.",
    };
  }

  if (isPositive(latest, 0) || isPositive(durable, 0)) {
    return {
      label: "Moderate growth",
      summary:
        "The growth read is positive, but the signal mix is not strong enough to call it durable.",
    };
  }

  return {
    label: "Soft growth",
    summary: "Growth signals are weak or mixed.",
  };
}

function deriveInvestmentGrowthInterpretation(
  input: GrowthHeadlineInterpretationInput,
): GrowthHeadlineInterpretation {
  const latest = input.latestGrowthValue;
  const durable = input.durableGrowthValue;
  const consistency = input.consistencyValue;
  const acceleration = input.accelerationValue;

  if (isPositive(durable, 0.1) && isPositive(consistency, 0.75)) {
    if (isNegative(acceleration, -0.05)) {
      return {
        label: "Investment growth cooling",
        summary:
          "Capital spending is still elevated on a durable basis, but the growth pace is easing.",
      };
    }

    return {
      label: "Investment ramping",
      summary:
        "Capital spending is expanding consistently, which can indicate heavier reinvestment or capacity buildout.",
    };
  }

  if (isPositive(latest, 0.1)) {
    return {
      label: "Recent investment increase",
      summary:
        "The latest CapEx growth signal is positive, but durability is not yet confirmed.",
    };
  }

  if (isNegative(latest, -0.05) && isNegative(durable, -0.05)) {
    return {
      label: "Investment pullback",
      summary: "Recent and durable CapEx signals point to lower investment spending.",
    };
  }

  return {
    label: "Stable investment pace",
    summary:
      "Capital spending signals are not showing a clear ramp-up or pullback.",
  };
}

function appendContext(
  summary: string,
  input: GrowthHeadlineInterpretationInput,
): string {
  const context: string[] = [];

  if (input.usPublicEquitiesPercentile != null) {
    if (input.usPublicEquitiesPercentile >= 0.75) {
      context.push("It ranks high versus US public equities");
    } else if (input.usPublicEquitiesPercentile <= 0.25) {
      context.push("It ranks low versus US public equities");
    } else if (input.usPublicEquitiesDistanceToMedian != null) {
      context.push(
        input.usPublicEquitiesDistanceToMedian >= 0
          ? "It sits above the US public-equity median"
          : "It sits below the US public-equity median",
      );
    }
  }

  if (input.sectorPercentile != null) {
    if (input.sectorPercentile >= 0.75) {
      context.push("sector-relative position is also strong");
    } else if (input.sectorPercentile <= 0.25) {
      context.push("sector-relative position is weak");
    }
  }

  if (input.trendDeviationValue != null) {
    if (input.trendDeviationValue >= 0.1) {
      context.push("the latest value is above its rolling trend");
    } else if (input.trendDeviationValue <= -0.1) {
      context.push("the latest value is below its rolling trend");
    }
  }

  if (input.dataQualityLevel === "medium") {
    context.push("confidence is moderate");
  } else if (input.dataQualityLevel === "low") {
    context.push("confidence is low");
  }

  if (context.length === 0) {
    return summary;
  }

  return `${summary} ${context.join("; ")}.`;
}

function isInvestmentMetric(metricKey: SecMetricKey): boolean {
  return metricKey === "capex_cash" || metricKey === "capex_incurred";
}

function isPositive(value: number | null, threshold: number): boolean {
  return value != null && Number.isFinite(value) && value >= threshold;
}

function isNegative(value: number | null, threshold: number): boolean {
  return value != null && Number.isFinite(value) && value <= threshold;
}

function isNearFlat(value: number | null): boolean {
  return value != null && Number.isFinite(value) && Math.abs(value) < 0.05;
}
