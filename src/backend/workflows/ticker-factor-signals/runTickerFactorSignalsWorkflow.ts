import { buildTickerFactorSignals } from "@/backend/services/sec/companyFacts/series/signal/buildTickerFactorSignals";
import { db } from "@/backend/config/db";
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

async function loadSignalTargetsFromDefinitions(): Promise<
  TickerFactorSignalTarget[]
> {
  const result = await db.query<TickerFactorSignalTarget>(
    `
    SELECT DISTINCT
      factor,
      axis
    FROM public.ticker_factor_signal_definitions
    WHERE model_key = 'factor_signal'
      AND model_version = 'v0'
      AND is_active = true
    ORDER BY factor ASC, axis ASC
    `,
  );

  return dedupeSignalTargets(result.rows);
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
    : await loadSignalTargetsFromDefinitions();

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
