export type SecBulkIngestWorkflowResult = {
  zipFilePath: string;
  didDownload: boolean;
  didSkipIngest: boolean;

  archiveMtimeIso: string | null;
  archiveMtimeNy: string | null;
  refreshCutoffNy: string;

  totalCount: number;
  newCount: number;
  sameSizeSkipCount: number;
  changedSizeCount: number;

  processedCount: number;
  skippedEmptyFactsCount: number;
  failedCount: number;
};
