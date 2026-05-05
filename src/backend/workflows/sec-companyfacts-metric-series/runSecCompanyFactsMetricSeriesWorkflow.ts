import { buildCompanyFactsMetricSeriesForCik } from "@/backend/services/sec/companyFacts/series/metric/buildCompanyFactsMetricSeriesForCik";
import { assignPeriodLabelsToMetricSeriesForCik } from "@/backend/services/sec/companyFacts/series/period/assignPeriodLabelsToMetricSeriesForCik";
import { buildCompanyFactsMetricSeriesEnrichedForCik } from "@/backend/services/sec/companyFacts/series/enriched/buildCompanyFactsMetricSeriesEnrichedForCik";
import { buildMetricSeriesReliabilityForCik } from "@/backend/services/sec/companyFacts/series/reliability/buildMetricSeriesReliabilityForCik";
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
  let reliabilityCount = 0;
  let reliabilityMetricCount = 0;

  for (const [ticker, cik] of entries) {
    if (!cik) continue;

    processed += 1;
    const startTime = Date.now();

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

      const reliabilityResult = await buildMetricSeriesReliabilityForCik({
        ticker,
        cik,
        metricKey: input.rebuildMode === "metric" ? input.metricKey : undefined,
      });
      reliabilityCount += reliabilityResult.reliabilityCount;
      reliabilityMetricCount += reliabilityResult.metricCount;

      const elapsedMs = Date.now() - startTime;
      input.onProgress?.({
        job: "metric_series",
        message: `Metric series completed (${processed}/${entries.length}) ${ticker} in ${elapsedMs}ms.`,
        current: processed,
        total: entries.length,
        label: ticker,
      });
    } catch (err) {
      console.error(`[metric-series] failed for ticker=${ticker}, cik=${cik}`, err);
    }
  }

  input.onProgress?.({
    job: "metric_series",
    message: `Metric series build completed. reliabilityRecords=${reliabilityCount}.`,
    current: entries.length,
    total: entries.length,
  });
}
