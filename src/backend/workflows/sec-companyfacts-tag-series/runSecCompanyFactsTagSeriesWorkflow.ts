import { buildCompanyFactsTagSeriesForCik } from "@/backend/services/sec/companyFacts/series/tag/buildCompanyFactsTagSeriesForCik";
import type { DataPipelineRefreshJobKey } from "@/shared/data-pipeline/jobs";

type WorkflowProgress = {
  job?: DataPipelineRefreshJobKey;
  message: string;
  current?: number;
  total?: number;
  label?: string;
};

export async function runSecCompanyFactsTagSeriesWorkflow(input: {
  tickerCikMap: Record<string, string | null>;
  onProgress?: (progress: WorkflowProgress) => void;
}) {
  const entries = Object.entries(input.tickerCikMap).filter(([, cik]) =>
    Boolean(cik),
  );

  process.stdout.write(`[tag-series] start total=${entries.length}\n`);
  input.onProgress?.({
    job: "tag_series",
    message: "Tag series build started.",
    current: 0,
    total: entries.length,
  });

  let processed = 0;

  for (const [ticker, cik] of entries) {
    if (!cik) continue;

    processed += 1;
    const startTime = Date.now();
    input.onProgress?.({
      job: "tag_series",
      message: `Tag series processing ${ticker}.`,
      current: processed,
      total: entries.length,
      label: ticker,
    });

    process.stdout.write(
      `\r[tag-series] (${processed}/${entries.length}) processing ${ticker}`,
    );

    try {
      await buildCompanyFactsTagSeriesForCik({ ticker, cik });

      const elapsedMs = Date.now() - startTime;
      process.stdout.write(
        `\r[tag-series] (${processed}/${entries.length}) done ${ticker} in ${elapsedMs}ms`,
      );
      input.onProgress?.({
        job: "tag_series",
        message: `Tag series completed ${ticker} in ${elapsedMs}ms.`,
        current: processed,
        total: entries.length,
        label: ticker,
      });
    } catch (err) {
      process.stdout.write("\n");
      console.error(`[tag-series] failed for ticker=${ticker}, cik=${cik}`, err);
    }
  }

  process.stdout.write("\n[tag-series] done all\n");
  input.onProgress?.({
    job: "tag_series",
    message: "Tag series build completed.",
    current: entries.length,
    total: entries.length,
  });
}
