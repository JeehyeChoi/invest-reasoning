import { ingestCompanyFactsBulk } from "@/backend/services/sec/companyFacts/ingestCompanyFactsBulk";
import type { SecBulkIngestWorkflowResult } from "./workflow.types";

export async function runSecBulkIngestWorkflow(input: {
  allowedCiks: Set<string>;
}): Promise<SecBulkIngestWorkflowResult> {
  const result = await ingestCompanyFactsBulk({allowedCiks: input.allowedCiks});

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

    processedCount: result.processedCount,
    skippedEmptyFactsCount: result.skippedEmptyFactsCount,
    failedCount: result.failedCount,
  };
}
