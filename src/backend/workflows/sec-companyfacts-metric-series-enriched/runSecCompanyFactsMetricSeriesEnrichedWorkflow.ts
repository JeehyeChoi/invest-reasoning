import { buildCompanyFactsMetricSeriesEnrichedForCik } from "@/backend/services/sec/companyFacts/series/enriched/buildCompanyFactsMetricSeriesEnrichedForCik";
import { buildMetricSeriesReliabilityForCik } from "@/backend/services/sec/companyFacts/series/reliability/buildMetricSeriesReliabilityForCik";
import type { DataPipelineRefreshJobKey } from "@/shared/data-pipeline/jobs";
import type { SecMetricKey } from "@/shared/sec/metrics";

type WorkflowProgress = {
  job?: DataPipelineRefreshJobKey;
  message: string;
  current?: number;
  total?: number;
  label?: string;
};

type RunMetricEnrichedWorkflowInput = {
  tickerCikMap: Record<string, string | null>;
  rebuildMode?: "metric" | "all";
  metricKey?: SecMetricKey;
  onProgress?: (progress: WorkflowProgress) => void;
};

export async function runSecCompanyFactsMetricSeriesEnrichedWorkflow(
  input: RunMetricEnrichedWorkflowInput,
) {
  const entries = Object.entries(input.tickerCikMap).filter(([, cik]) =>
    Boolean(cik),
  );

  input.onProgress?.({
    job: "sec_metric_series_enriched",
    message: "SEC metric enriched series build started.",
    current: 0,
    total: entries.length,
  });

  if (input.rebuildMode === "metric" && !input.metricKey) {
    throw new Error("metric enriched rebuild requires metricKey");
  }

  let processed = 0;
  let reliabilityCount = 0;
  let reliabilityMetricCount = 0;

  for (const [ticker, cik] of entries) {
    if (!cik) continue;

    processed += 1;
    const startTime = Date.now();

    try {
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
        job: "sec_metric_series_enriched",
        message: `SEC metric enriched series completed (${processed}/${entries.length}) ${ticker} in ${elapsedMs}ms. reliabilityRecords=${reliabilityResult.reliabilityCount}.`,
        current: processed,
        total: entries.length,
        label: ticker,
      });
    } catch (err) {
      console.error(
        `[metric-series-enriched] failed for ticker=${ticker}, cik=${cik}`,
        err,
      );
    }
  }

  input.onProgress?.({
    job: "sec_metric_series_enriched",
    message: `SEC metric enriched series build completed. processed=${processed}, reliabilityMetrics=${reliabilityMetricCount}, reliabilityRecords=${reliabilityCount}.`,
    current: entries.length,
    total: entries.length,
  });
}
