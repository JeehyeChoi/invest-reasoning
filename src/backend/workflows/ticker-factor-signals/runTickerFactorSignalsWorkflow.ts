import { FACTOR_BLUEPRINTS } from "@/backend/config/factors/blueprints";
import { buildTickerFactorSignals } from "@/backend/services/sec/companyFacts/series/signal/buildTickerFactorSignals";
import type { FactorAxisKey } from "@/shared/factors/axes";
import type { FactorKey } from "@/shared/factors/factors";

export type RunTickerFactorSignalsWorkflowInput = {
  targets?: TickerFactorSignalTarget[];
  onProgress?: (progress: {
    message: string;
    current?: number;
    total?: number;
    label?: string;
  }) => void;
};

export type TickerFactorSignalTarget = {
  factor: FactorKey;
  axis: FactorAxisKey;
};

export type TickerFactorSignalsWorkflowResult = {
  processed: number;
};

function buildSignalTargetsFromBlueprints(): TickerFactorSignalTarget[] {
  const targets: TickerFactorSignalTarget[] = [];

  for (const [factor, factorBlueprint] of Object.entries(FACTOR_BLUEPRINTS)) {
    if (!factorBlueprint) continue;

    for (const [axis, axisBlueprint] of Object.entries(factorBlueprint)) {
      if (axisBlueprint.metricKeys.length === 0) continue;

      targets.push({
        factor: factor as FactorKey,
        axis: axis as FactorAxisKey,
      });
    }
  }

  return dedupeSignalTargets(targets);
}

function dedupeSignalTargets(
  targets: TickerFactorSignalTarget[],
): TickerFactorSignalTarget[] {
  const seen = new Set<string>();
  const output: TickerFactorSignalTarget[] = [];

  for (const target of targets) {
    const key = `${target.factor}:${target.axis}`;
    if (seen.has(key)) continue;

    seen.add(key);
    output.push(target);
  }

  return output;
}

export async function runTickerFactorSignalsWorkflow(
  input: RunTickerFactorSignalsWorkflowInput = {},
): Promise<TickerFactorSignalsWorkflowResult> {
  const targets = input.targets
    ? dedupeSignalTargets(input.targets)
    : buildSignalTargetsFromBlueprints();

  for (const [index, target] of targets.entries()) {
    const label = `${target.factor}/${target.axis}`;

    input.onProgress?.({
      message: `Factor signals building ${label}.`,
      current: index + 1,
      total: targets.length,
      label,
    });

    await buildTickerFactorSignals({
      factor: target.factor,
      axis: target.axis,
    });

    input.onProgress?.({
      message: `Factor signals completed ${label}.`,
      current: index + 1,
      total: targets.length,
      label,
    });
  }

  return {
    processed: targets.length,
  };
}
