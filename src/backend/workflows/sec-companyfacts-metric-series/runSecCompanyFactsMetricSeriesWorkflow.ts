import { buildCompanyFactsMetricSeriesForCik } from "@/backend/services/sec/companyFacts/series/metric/buildCompanyFactsMetricSeriesForCik";
import { assignPeriodLabelsToMetricSeriesForCik } from "@/backend/services/sec/companyFacts/series/period/assignPeriodLabelsToMetricSeriesForCik";
import { buildCompanyFactsMetricSeriesEnrichedForCik } from "@/backend/services/sec/companyFacts/series/enriched/buildCompanyFactsMetricSeriesEnrichedForCik";
import type { SecMetricKey } from "@/shared/sec/metrics";
import type { DataPipelineRefreshJobKey } from "@/shared/data-pipeline/jobs";

type WorkflowProgress = {
  job?: DataPipelineRefreshJobKey;
  message: string;
  current?: number;
  total?: number;
  label?: string;
};

type RunMetricWorkflowInput = {
  tickerCikMap: Record<string, string | null>;
  rebuild?: boolean;
  rebuildMode?: "metric" | "all";
  metricKey?: SecMetricKey;
  onProgress?: (progress: WorkflowProgress) => void;
};

export async function runSecCompanyFactsMetricSeriesWorkflow(
  input: RunMetricWorkflowInput,
) {
  const entries = Object.entries(input.tickerCikMap).filter(([, cik]) =>
    Boolean(cik),
  );

  process.stdout.write(`[metric-series] start total=${entries.length}\n`);
  input.onProgress?.({
    job: "metric_series",
    message: "Metric series build started.",
    current: 0,
    total: entries.length,
  });

  if (input.rebuildMode === "metric" && !input.metricKey) {
    throw new Error("metric rebuild requires metricKey");
  }

  let processed = 0;

  for (const [ticker, cik] of entries) {
    if (!cik) continue;

    processed += 1;
    const startTime = Date.now();
    input.onProgress?.({
      job: "metric_series",
      message: `Metric series processing ${ticker}.`,
      current: processed,
      total: entries.length,
      label: ticker,
    });

    process.stdout.write(
      `\r[metric-series] (${processed}/${entries.length}) processing ${ticker}`,
    );

    try {
			await buildCompanyFactsMetricSeriesForCik({
        ticker,
        cik,
        metricKey: input.rebuildMode === "metric" ? input.metricKey : undefined,
      });
			await assignPeriodLabelsToMetricSeriesForCik({ ticker, cik });

			await buildCompanyFactsMetricSeriesEnrichedForCik({
				ticker,
				cik,
				metricKey: input.rebuildMode === "metric" ? input.metricKey : undefined,
			});

      const elapsedMs = Date.now() - startTime;
      process.stdout.write(
        `\r[metric-series] (${processed}/${entries.length}) done ${ticker} in ${elapsedMs}ms`,
      );
      input.onProgress?.({
        job: "metric_series",
        message: `Metric series completed ${ticker} in ${elapsedMs}ms.`,
        current: processed,
        total: entries.length,
        label: ticker,
      });
    } catch (err) {
      process.stdout.write("\n");
      console.error(`[metric-series] failed for ticker=${ticker}, cik=${cik}`, err);
    }
  }

  process.stdout.write("\n[metric-series] done all\n");
  input.onProgress?.({
    job: "metric_series",
    message: "Metric series build completed.",
    current: entries.length,
    total: entries.length,
  });
}
