import { resolve } from "@/backend/services/factors/growth/fundamentals_based/revenue/resolve";
import { compute } from "@/backend/services/factors/growth/fundamentals_based/revenue/compute";
import { upsert } from "@/backend/services/factors/growth/fundamentals_based/revenue/upsert";
import { resolveFactorConfig } from "@/backend/config/factors/active";

import type {
  TickerFactorSnapshotStepResult,
  TickerFactorSnapshotWorkflowState,
} from "@/backend/workflows/ticker-factor-snapshot/workflow.types";

export async function run(
  state: TickerFactorSnapshotWorkflowState,
): Promise<TickerFactorSnapshotStepResult> {
  const warnings: string[] = [];

  const total = state.tickers.length;
  let processed = 0;
  let succeeded = 0;

  for (const ticker of state.tickers) {
    processed += 1;

    process.stdout.write(
      `\r[revenue.run] progress ${processed}/${total} succeeded=${succeeded} warnings=${warnings.length}`,
    );

    const cik = state.meta?.tickerCikMap?.[ticker] ?? null;

    if (!cik) {
      warnings.push(`[revenue.run] missing cik ticker=${ticker}`);
      continue;
    }

    try {
      const series = await resolve({ cik });

      if (!series || series.length === 0) {
        warnings.push(`[revenue.run] empty series ticker=${ticker}`);
        continue;
      }

      const { model, config } = await resolveFactorConfig({
        factor: "growth",
        axis: "fundamentals_based",
        metricKey: "revenue",
      });

      const metrics = compute(series, config);

      if (!metrics) {
        warnings.push(`[revenue.run] compute returned null ticker=${ticker}`);
        continue;
      }

      state.factorInputs[ticker] ??= {};
      state.factorInputs[ticker].growth ??= {};
      state.factorInputs[ticker].growth!.fundamentalsBased ??= {};
      state.factorInputs[ticker].growth!.fundamentalsBased!.revenue = metrics;

      const latestPoint = series[series.length - 1];
      const effectiveDate = latestPoint?.end ?? null;

      await upsert({
        ticker,
        cik,
        effectiveDate,
        metrics,
        sourcePointCount: series.length,
        sourceWindowEnd: latestPoint?.end ?? null,
        model,
      });

      succeeded += 1;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown run error";

      warnings.push(`[revenue.run] ticker=${ticker} ${message}`);
    }
  }

  process.stdout.write("\n");

  console.log(
    `[revenue.run] done total=${total} succeeded=${succeeded} warnings=${warnings.length}`,
  );

  if (warnings.length > 0) {
    console.log("[revenue.run] warning samples:", warnings.slice(0, 10));
  }

  return {
    state,
    warnings,
  };
}
