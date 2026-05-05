import { ingestCompanyFactsBulk } from "@/backend/services/sec/companyFacts/bulk/ingestCompanyFactsBulk";
import { buildCompanyFiscalProfileForCik } from "@/backend/services/sec/companyFacts/series/fiscal/buildCompanyFiscalProfileForCik";
import { buildCompanyFactsTagSeriesForCik } from "@/backend/services/sec/companyFacts/series/tag/buildCompanyFactsTagSeriesForCik";
import { deleteCompanyFactRawRowsForCik } from "@/backend/services/sec/companyFacts/series/deleteCompanyFactRawRowsForCik";
import type { DataPipelineRefreshJobKey } from "@/shared/data-pipeline/jobs";
import type { SecBulkIngestWorkflowResult } from "./workflow.types";

type WorkflowProgress = {
  job?: DataPipelineRefreshJobKey;
  message: string;
  level?: "info" | "warning" | "error";
  current?: number;
  total?: number;
  label?: string;
};

export async function runSecBulkIngestWorkflow(input: {
  allowedCiks: Set<string>;
  forceReadAll?: boolean;
  tickerByCik?: Map<string, string>;
  buildFiscalProfileBeforeRawCleanup?: boolean;
  buildTagSeriesBeforeRawCleanup?: boolean;
  onProgress?: (progress: WorkflowProgress) => void;
}): Promise<SecBulkIngestWorkflowResult> {
  const result = await ingestCompanyFactsBulk({
    allowedCiks: input.allowedCiks,
    forceReadAll: input.forceReadAll,
    onProgress: (progress) =>
      input.onProgress?.({
        job: "sec_bulk_ingest",
        message: progress.message,
        level: progress.level,
        current: progress.current,
        total: progress.total,
        label: progress.label,
      }),
    afterCompanyRawIngest: async (context) => {
      const ticker = input.tickerByCik?.get(context.cik);

      if (!ticker) {
        await deleteCompanyFactRawRowsForCik({ cik: context.cik });
        input.onProgress?.({
          job: "sec_bulk_ingest",
          message: `[SEC BULK] Raw rows cleaned up for cik=${context.cik}; ticker mapping unavailable.`,
          label: context.cik,
        });
        return;
      }

      if (input.buildFiscalProfileBeforeRawCleanup) {
        await buildCompanyFiscalProfileForCik({ ticker, cik: context.cik });
        input.onProgress?.({
          job: "fiscal_profile",
          message: `[SEC BULK -> FISCAL] Fiscal profile completed for ${ticker}.`,
          label: ticker,
        });
      }

      if (input.buildTagSeriesBeforeRawCleanup) {
        await buildCompanyFactsTagSeriesForCik({ ticker, cik: context.cik });
        input.onProgress?.({
          job: "sec_bulk_ingest",
          message: `[SEC BULK -> TAG] Tag series completed for ${ticker}.`,
          label: ticker,
        });
      }

      const deletedRows = await deleteCompanyFactRawRowsForCik({ cik: context.cik });
      input.onProgress?.({
        job: "sec_bulk_ingest",
        message: `[SEC BULK] Raw rows cleaned up for ${ticker}. deletedRows=${deletedRows}.`,
        label: ticker,
      });
    },
  });

  return {
    zipFilePath: result.zipFilePath,
    didDownload: result.didDownload,
    didSkipIngest: result.didSkipIngest,

    archiveMtimeIso: result.archiveMtimeIso,
    archiveMtimeNy: result.archiveMtimeNy,
    refreshCutoffNy: result.refreshCutoffNy,

    totalCount: result.totalCount,
    newCount: result.newCount,
    sameSizeSkipCount: result.sameSizeSkipCount,
    changedSizeCount: result.changedSizeCount,
    changedCiks: result.changedCiks,

    processedCount: result.processedCount,
    skippedEmptyFactsCount: result.skippedEmptyFactsCount,
    failedCount: result.failedCount,
  };
}
