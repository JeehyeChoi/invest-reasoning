import fs from "fs";

import { downloadSecBulkArchiveToFile } from "@/backend/services/sec/companyFacts/bulk/downloadSecBulkArchiveToFile";
import { ensureFreshSecBulkArchive } from "@/backend/services/sec/companyFacts/bulk/ensureFreshSecBulkArchive";
import { scanCompanyFactsZipEntries } from "@/backend/services/sec/companyFacts/bulk/scanCompanyFactsZipEntries";
import { processCompanyFactsZipEntries } from "@/backend/services/sec/companyFacts/bulk/processCompanyFactsZipEntries";
import { upsertSecBulkIngestState } from "@/backend/services/sec/companyFacts/bulk/secBulkIngestStateRepository";


import { flattenCompanyFacts } from "@/backend/services/sec/companyFacts/raw/flattenCompanyFacts";
import { loadCompanyFactsStateMap } from "@/backend/services/sec/companyFacts/raw/loadCompanyFactsStateMap";
import { upsertSecCompanyFactRows } from "@/backend/services/sec/companyFacts/raw/upsertSecCompanyFactRows";
import { upsertSecCompanyFactCompanyState } from "@/backend/services/sec/companyFacts/raw/upsertSecCompanyFactCompanyState";
import {
  deleteCompanyFactRawRowsForCik,
  truncateCompanyFactRawRows,
} from "@/backend/services/sec/companyFacts/series/deleteCompanyFactRawRowsForCik";

type CompanyFactsBulkIngestProgress = {
  message: string;
  level?: "info" | "warning" | "error";
  current?: number;
  total?: number;
  label?: string;
};

export type CompanyFactsBulkIngestResult = {
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
  changedCiks: string[];
  processedCount: number;
  skippedEmptyFactsCount: number;
  failedCount: number;
};

type CompanyFactsBulkIngestCompanyContext = {
  cik: string;
  entrySize: number;
  entityName: string | null;
  isActive: boolean;
  rawRowCount: number;
};

export async function ingestCompanyFactsBulk(input: {
  allowedCiks: Set<string>;
  forceReadAll?: boolean;
  onProgress?: (progress: CompanyFactsBulkIngestProgress) => void;
  afterCompanyRawIngest?: (
    context: CompanyFactsBulkIngestCompanyContext,
  ) => Promise<void>;
}): Promise<CompanyFactsBulkIngestResult> {
  const dataset = "companyfacts" as const;
  const archiveDecision = await ensureFreshSecBulkArchive(dataset);

  let zipFilePath = archiveDecision.zipFilePath;
  let archiveMtimeIso = archiveDecision.archiveMtimeIso;
  let archiveMtimeNy = archiveDecision.archiveMtimeNy;
  let archiveFileSize = archiveDecision.archiveFileSize;
  let didDownload = false;

  // 1) archive download 단계
  if (archiveDecision.shouldDownload) {
    await upsertSecBulkIngestState({
      dataset,
      archive_path: zipFilePath,
      archive_mtime_iso: archiveMtimeIso,
      archive_file_size: archiveFileSize,
      archive_status: "downloading",
      archive_error: null,
      archive_checked_at: new Date().toISOString(),
    });

    try {
      zipFilePath = await downloadSecBulkArchiveToFile(dataset);
      didDownload = true;

      const stat = fs.statSync(zipFilePath);
      archiveMtimeIso = stat.mtime.toISOString();
      archiveMtimeNy = archiveDecision.archiveMtimeNy;
      archiveFileSize = stat.size;

      await upsertSecBulkIngestState({
        dataset,
        archive_path: zipFilePath,
        archive_mtime_iso: archiveMtimeIso,
        archive_file_size: archiveFileSize,
        archive_status: "ready",
        archive_error: null,
        archive_checked_at: new Date().toISOString(),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to download SEC bulk archive";

      await upsertSecBulkIngestState({
        dataset,
        archive_path: zipFilePath,
        archive_mtime_iso: archiveMtimeIso,
        archive_file_size: archiveFileSize,
        archive_status: "failed",
        archive_error: message,
        archive_checked_at: new Date().toISOString(),
      });

      throw error;
    }
  } else {
    await upsertSecBulkIngestState({
      dataset,
      archive_path: zipFilePath,
      archive_mtime_iso: archiveMtimeIso,
      archive_file_size: archiveFileSize,
      archive_status: "ready",
      archive_error: null,
      archive_checked_at: new Date().toISOString(),
    });
  }

  // 2) ingest 완료 여부 확인 >> 브라우저에서 확인

  // 3) ingest 시작 상태 기록
	try {
    await truncateCompanyFactRawRows();
    input.onProgress?.({
      message: "[SEC BULK] Existing raw companyfacts rows truncated before ingest.",
    });

		const stateMap = await loadCompanyFactsStateMap();
		const scanResult = await scanCompanyFactsZipEntries(
			zipFilePath,
			stateMap,
			input.allowedCiks,
      { forceReadAll: input.forceReadAll },
		);

		if (scanResult.entriesToRead.length === 0) {
      input.onProgress?.({
        message:
          "[SEC BULK] No company entries changed by file size. Skipping raw ingest.",
        current: 0,
        total: scanResult.totalCount,
      });
      const completedAt = new Date().toISOString();

			await upsertSecBulkIngestState({
				dataset,
				archive_path: zipFilePath,
				archive_mtime_iso: archiveMtimeIso,
				archive_file_size: archiveFileSize,
				archive_status: "ready",
				ingest_status: "completed",
				ingest_error: null,
				ingest_started_at: completedAt,
				ingest_completed_at: completedAt,
			});

			return {
				zipFilePath,
				didDownload,
				didSkipIngest: true,
				archiveMtimeIso,
				archiveMtimeNy,
				refreshCutoffNy: archiveDecision.refreshCutoffNy,
				totalCount: scanResult.totalCount,
				newCount: scanResult.newCount,
				sameSizeSkipCount: scanResult.sameSizeSkipCount,
				changedSizeCount: scanResult.changedSizeCount,
				changedCiks: [],
				processedCount: 0,
				skippedEmptyFactsCount: 0,
				failedCount: 0,
			};
		}

    input.onProgress?.({
      message: input.forceReadAll
        ? `[SEC BULK] Starting full-scope processing ${scanResult.entriesToRead.length} entries.`
        : `[SEC BULK] Starting changed-entry processing ${scanResult.entriesToRead.length} entries.`,
      current: 0,
      total: scanResult.entriesToRead.length,
    });

		await upsertSecBulkIngestState({
			dataset,
			archive_path: zipFilePath,
			archive_mtime_iso: archiveMtimeIso,
			archive_file_size: archiveFileSize,
			ingest_status: "running",
			ingest_error: null,
			ingest_started_at: new Date().toISOString(),
			ingest_completed_at: null,
		});

    let processedCount = 0;
    let skippedEmptyFactsCount = 0;
    let failedCount = 0;
    const changedCiks: string[] = [];
    let currentIndex = 0;
    const totalToProcess = scanResult.entriesToRead.length;

    await processCompanyFactsZipEntries(zipFilePath, scanResult.entriesToRead, {
      async onDocument(entry, doc) {
        currentIndex += 1;
        input.onProgress?.({
          message: `[SEC BULK -> RAW] ${currentIndex}/${totalToProcess} processing cik=${entry.cik}.`,
          current: currentIndex,
          total: totalToProcess,
          label: entry.cik,
        });

        const now = new Date().toISOString();

        if (!doc.facts || Object.keys(doc.facts).length === 0) {
          skippedEmptyFactsCount += 1;

          await deleteCompanyFactRawRowsForCik({ cik: entry.cik });

          await upsertSecCompanyFactCompanyState({
            cik: entry.cik,
            entity_name: doc.entityName ?? null,
            is_active: false,
            last_file_size: entry.size,
            last_processed_at: now,
            last_filed: null,
            last_end: null,
          });

          await input.afterCompanyRawIngest?.({
            cik: entry.cik,
            entrySize: entry.size,
            entityName: doc.entityName ?? null,
            isActive: false,
            rawRowCount: 0,
          });

          changedCiks.push(entry.cik);
          return;
        }

        const rows = flattenCompanyFacts(doc, {
          workflowType: "sec_companyfacts_bulk_v1",
        });

        const isActive = rows.length > 0;

        if (isActive) {
          await deleteCompanyFactRawRowsForCik({ cik: entry.cik });
          await upsertSecCompanyFactRows(rows);
          processedCount += 1;
        } else {
          await deleteCompanyFactRawRowsForCik({ cik: entry.cik });
          skippedEmptyFactsCount += 1;
        }

        const lastFiled =
          rows
            .map((row) => row.filed)
            .filter((v): v is string => typeof v === "string" && v.length > 0)
            .sort()
            .at(-1) ?? null;

        const lastEnd =
          rows
            .map((row) => row.end)
            .filter((v): v is string => typeof v === "string" && v.length > 0)
            .sort()
            .at(-1) ?? null;

        await upsertSecCompanyFactCompanyState({
          cik: entry.cik,
          entity_name: doc.entityName ?? null,
          is_active: isActive,
          last_file_size: entry.size,
          last_processed_at: now,
          last_filed: lastFiled,
          last_end: lastEnd,
        });

        await input.afterCompanyRawIngest?.({
          cik: entry.cik,
          entrySize: entry.size,
          entityName: doc.entityName ?? null,
          isActive,
          rawRowCount: rows.length,
        });

        changedCiks.push(entry.cik);
      },

      async onError(entry, error) {
        failedCount += 1;

        const now = new Date().toISOString();
        const message = error instanceof Error ? error.message : String(error);

        input.onProgress?.({
          message: `[SEC BULK -> RAW] failed cik=${entry.cik}: ${message}`,
          level: "error",
          current: currentIndex,
          total: totalToProcess,
          label: entry.cik,
        });

        await upsertSecCompanyFactCompanyState({
          cik: entry.cik,
          entity_name: null,
          is_active: false,
          last_file_size: entry.size,
          last_processed_at: now,
          last_filed: null,
          last_end: null,
        });
      },
    });

    input.onProgress?.({
      message: `[SEC BULK] Raw ingest completed. processed=${processedCount}, skippedEmptyFacts=${skippedEmptyFactsCount}, failed=${failedCount}.`,
      current: totalToProcess,
      total: totalToProcess,
    });

    await upsertSecBulkIngestState({
      dataset,
      archive_path: zipFilePath,
      archive_mtime_iso: archiveMtimeIso,
      archive_file_size: archiveFileSize,
      archive_status: "ready",
      ingest_status: "completed",
      ingest_error: null,
      ingest_completed_at: new Date().toISOString(),
    });

    return {
      zipFilePath,
      didDownload,
      didSkipIngest: false,
      archiveMtimeIso,
      archiveMtimeNy,
      refreshCutoffNy: archiveDecision.refreshCutoffNy,
      totalCount: scanResult.totalCount,
      newCount: scanResult.newCount,
      sameSizeSkipCount: scanResult.sameSizeSkipCount,
      changedSizeCount: scanResult.changedSizeCount,
      changedCiks,
      processedCount,
      skippedEmptyFactsCount,
      failedCount,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown SEC bulk ingest error";

    await upsertSecBulkIngestState({
      dataset,
      archive_path: zipFilePath,
      archive_mtime_iso: archiveMtimeIso,
      archive_file_size: archiveFileSize,
      archive_status: "ready",
      ingest_status: "failed",
      ingest_error: message,
      ingest_completed_at: null,
    });

    throw error;
  }
}
