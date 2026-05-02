import { toUtcDateMs } from "@/backend/services/sec/companyFacts/series/utils/dateKey";

export function calculateDurationDays(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined,
): number | null {
  const startMs = toUtcDateMs(start);
  const endMs = toUtcDateMs(end);

  if (startMs === null || endMs === null || endMs < startMs) {
    return null;
  }

  const dayMs = 24 * 60 * 60 * 1000;
  return Math.floor((endMs - startMs) / dayMs) + 1;
}
