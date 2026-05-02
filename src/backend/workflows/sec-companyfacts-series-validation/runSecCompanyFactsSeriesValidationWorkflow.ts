import { runValidateMetricSeriesForCik } from "@/backend/services/sec/companyFacts/series/validation/runValidateMetricSeriesForCik";
import type { DataPipelineRefreshJobKey } from "@/shared/data-pipeline/jobs";

type WorkflowProgress = {
  job?: DataPipelineRefreshJobKey;
  message: string;
  current?: number;
  total?: number;
  label?: string;
};

export async function runSecCompanyFactsSeriesValidationWorkflow(input: {
  tickerCikMap: Record<string, string | null>;
  onProgress?: (progress: WorkflowProgress) => void;
}) {
  process.stdout.write("[series-validation] start\n");

  const entries = Object.entries(input.tickerCikMap).filter(([, cik]) =>
    Boolean(cik),
  );

  let total = 0;
  let warn = 0;
  let fail = 0;

  input.onProgress?.({
    job: "series_validation",
    message: "Series validation started.",
    current: 0,
    total: entries.length,
  });

  for (const [ticker, cik] of entries) {
    if (!cik) continue;

    input.onProgress?.({
      job: "series_validation",
      message: `Series validation processing ${ticker}.`,
      current: total + 1,
      total: entries.length,
      label: ticker,
    });

    const { report } = await runValidateMetricSeriesForCik({
      ticker,
      cik,
    });

    total += 1;
    warn += report.warningCount > 0 ? 1 : 0;
    fail += report.errorCount > 0 ? 1 : 0;
  }

  process.stdout.write(
    `[series-validation] done total=${total} warn=${warn} fail=${fail}\n`,
  );
  input.onProgress?.({
    job: "series_validation",
    message: `Series validation completed. warnings=${warn} failures=${fail}.`,
    current: total,
    total: entries.length,
  });

  return {
    summary: {
      total,
      warn,
      fail,
    },
  };
}
