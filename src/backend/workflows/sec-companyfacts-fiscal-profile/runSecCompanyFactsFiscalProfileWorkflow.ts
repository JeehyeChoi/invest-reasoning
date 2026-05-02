import { buildCompanyFiscalProfileForCik } from "@/backend/services/sec/companyFacts/series/fiscal/buildCompanyFiscalProfileForCik";
import type { DataPipelineRefreshJobKey } from "@/shared/data-pipeline/jobs";

type WorkflowProgress = {
  job?: DataPipelineRefreshJobKey;
  message: string;
  current?: number;
  total?: number;
  label?: string;
};

export async function runSecCompanyFactsFiscalProfileWorkflow(input: {
  tickerCikMap: Record<string, string | null>;
  onProgress?: (progress: WorkflowProgress) => void;
}) {
  const entries = Object.entries(input.tickerCikMap).filter(([, cik]) =>
    Boolean(cik),
  );

  process.stdout.write(`[fiscal-profile] start total=${entries.length}\n`);
  input.onProgress?.({
    job: "fiscal_profile",
    message: "Fiscal profile build started.",
    current: 0,
    total: entries.length,
  });

  let processed = 0;

  for (const [ticker, cik] of entries) {
    if (!cik) continue;

    processed += 1;
    const startTime = Date.now();
    input.onProgress?.({
      job: "fiscal_profile",
      message: `Fiscal profile processing ${ticker}.`,
      current: processed,
      total: entries.length,
      label: ticker,
    });

    process.stdout.write(
      `\r[fiscal-profile] (${processed}/${entries.length}) processing ${ticker}`,
    );

    try {
      await buildCompanyFiscalProfileForCik({ ticker, cik });

      const elapsedMs = Date.now() - startTime;
      process.stdout.write(
        `\r[fiscal-profile] (${processed}/${entries.length}) done ${ticker} in ${elapsedMs}ms`,
      );
      input.onProgress?.({
        job: "fiscal_profile",
        message: `Fiscal profile completed ${ticker} in ${elapsedMs}ms.`,
        current: processed,
        total: entries.length,
        label: ticker,
      });
    } catch (err) {
      process.stdout.write("\n");
      console.error(`[fiscal-profile] failed for ticker=${ticker}, cik=${cik}`, err);
    }
  }

  process.stdout.write("\n[fiscal-profile] done all\n");
  input.onProgress?.({
    job: "fiscal_profile",
    message: "Fiscal profile build completed.",
    current: entries.length,
    total: entries.length,
  });
}
