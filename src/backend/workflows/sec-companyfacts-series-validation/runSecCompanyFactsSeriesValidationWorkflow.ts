import { runValidateMetricSeriesForCik } from "@/backend/services/sec/companyFacts/series/validation/runValidateMetricSeriesForCik";
import { buildActiveMetricKeysForValidation } from "@/backend/services/sec/companyFacts/series/validation/runValidateMetricSeriesForCik";
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
  concurrency?: number;
  writeReports?: boolean;
  onProgress?: (progress: WorkflowProgress) => void;
}) {
  const entries = Object.entries(input.tickerCikMap).filter(
    (entry): entry is [string, string] => Boolean(entry[1]),
  );

  let total = 0;
  let warn = 0;
  let fail = 0;
  const activeMetricKeys = buildActiveMetricKeysForValidation();
  const concurrency = normalizeConcurrency(input.concurrency, 4);

  input.onProgress?.({
    job: "series_validation",
    message: "Series validation started.",
    current: 0,
    total: entries.length,
  });

  await runWithConcurrency(entries, concurrency, async ([ticker, cik]) => {
    const startTime = Date.now();

    const { report } = await runValidateMetricSeriesForCik({
      ticker,
      cik,
      activeMetricKeys,
      writeReport: input.writeReports ?? false,
    });

    total += 1;
    warn += report.warningCount > 0 ? 1 : 0;
    fail += report.errorCount > 0 ? 1 : 0;

    const elapsedMs = Date.now() - startTime;
    input.onProgress?.({
      job: "series_validation",
      message: `Series validation completed (${total}/${entries.length}) ${ticker} in ${elapsedMs}ms.`,
      current: total,
      total: entries.length,
      label: ticker,
    });
  });

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

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const item = items[nextIndex];
      nextIndex += 1;
      await worker(item);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () =>
      runWorker(),
    ),
  );
}

function normalizeConcurrency(value: number | undefined, fallback: number) {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    return fallback;
  }

  return Math.min(value, 8);
}
