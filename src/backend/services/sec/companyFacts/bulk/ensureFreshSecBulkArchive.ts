import fs from "fs";
import path from "path";

import type { SecBulkDataset } from "@/backend/clients/secBulk";
import { ENV } from "@/backend/config/env";
import { getNewYorkDateParts } from "@/backend/utils/usMarketCalendar";

const SEC_BULK_REFRESH_HOUR = 3;
const SEC_BULK_REFRESH_MINUTE = 5;

export type SecBulkArchiveRefreshDecision = {
  zipFilePath: string;
  archiveExists: boolean;
  shouldDownload: boolean;
  archiveMtimeIso: string | null;
  archiveMtimeNy: string | null;
  archiveFileSize: number | null;
  refreshCutoffNy: string;
};

export async function ensureFreshSecBulkArchive(
  dataset: SecBulkDataset
): Promise<SecBulkArchiveRefreshDecision> {
  const zipFilePath = getSecBulkZipFilePath(dataset);
  const refreshCutoffNy = getLatestExpectedRefreshCutoffNy(new Date());

  if (!fs.existsSync(zipFilePath)) {
    return {
      zipFilePath,
      archiveExists: false,
      shouldDownload: true,
      archiveMtimeIso: null,
      archiveMtimeNy: null,
      archiveFileSize: null,
      refreshCutoffNy,
    };
  }

  const stat = fs.statSync(zipFilePath);
  const archiveMtimeNy = toMinuteKey(getNewYorkDateParts(stat.mtime));

  return {
    zipFilePath,
    archiveExists: true,
    shouldDownload: archiveMtimeNy < refreshCutoffNy,
    archiveMtimeIso: stat.mtime.toISOString(),
    archiveMtimeNy,
    archiveFileSize: stat.size,
    refreshCutoffNy,
  };
}

function getSecBulkZipFilePath(dataset: SecBulkDataset): string {
  return path.join(ENV.SEC_DATA_DIR, `sec-${dataset}.zip`);
}

function getLatestExpectedRefreshCutoffNy(now: Date): string {
  const nowNy = getNewYorkDateParts(now);
  const nowMinutes = nowNy.hour * 60 + nowNy.minute;
  const cutoffMinutes = SEC_BULK_REFRESH_HOUR * 60 + SEC_BULK_REFRESH_MINUTE;

  const cutoffDate =
    nowMinutes >= cutoffMinutes
      ? {
          year: nowNy.year,
          month: nowNy.month,
          day: nowNy.day,
        }
      : shiftYmdByDays(nowNy.year, nowNy.month, nowNy.day, -1);

  return toMinuteKey({
    ...cutoffDate,
    hour: SEC_BULK_REFRESH_HOUR,
    minute: SEC_BULK_REFRESH_MINUTE,
  });
}

function toMinuteKey(input: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}): string {
  return `${pad4(input.year)}-${pad2(input.month)}-${pad2(input.day)}T${pad2(
    input.hour
  )}:${pad2(input.minute)}`;
}

function shiftYmdByDays(
  year: number,
  month: number,
  day: number,
  days: number
): { year: number; month: number; day: number } {
  const utcDate = new Date(Date.UTC(year, month - 1, day + days));

  return {
    year: utcDate.getUTCFullYear(),
    month: utcDate.getUTCMonth() + 1,
    day: utcDate.getUTCDate(),
  };
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function pad4(value: number): string {
  return String(value).padStart(4, "0");
}
