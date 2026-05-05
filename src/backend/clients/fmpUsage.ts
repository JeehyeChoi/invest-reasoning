import { db } from "@/backend/config/db";

const FMP_PROVIDER = "fmp";
const ROLLING_WINDOW_DAYS = 30;
const FREE_PLAN_BANDWIDTH_LIMIT_BYTES = 500 * 1024 * 1024;
const WARNING_RATIO = 0.9;

export type FmpUsageSnapshot = {
  rollingWindowDays: number;
  bandwidthLimitBytes: number;
  consumedBytes: number;
  remainingBytes: number;
  consumedRatio: number;
  isWarning: boolean;
  isLimitReached: boolean;
};

export async function recordFmpApiUsage(input: {
  endpoint: string;
  statusCode: number;
  responseBytes: number;
}): Promise<FmpUsageSnapshot | null> {
  try {
    await db.query(
      `
      INSERT INTO provider_api_usage_events (
        provider,
        endpoint,
        status_code,
        response_bytes,
        requested_at
      )
      VALUES ($1, $2, $3, $4, NOW())
      `,
      [
        FMP_PROVIDER,
        input.endpoint,
        input.statusCode,
        input.responseBytes,
      ],
    );

    return await getFmpUsageSnapshot();
  } catch (error) {
    console.warn("FMP usage tracking failed:", error);
    return null;
  }
}

export async function getFmpUsageSnapshot(): Promise<FmpUsageSnapshot> {
  const result = await db.query<{ consumed_bytes: string }>(
    `
    SELECT COALESCE(SUM(response_bytes), 0)::bigint AS consumed_bytes
    FROM provider_api_usage_events
    WHERE provider = $1
      AND requested_at >= NOW() - ($2::int * INTERVAL '1 day')
    `,
    [FMP_PROVIDER, ROLLING_WINDOW_DAYS],
  );

  const consumedBytes = Number(result.rows[0]?.consumed_bytes ?? 0);
  const remainingBytes = Math.max(
    FREE_PLAN_BANDWIDTH_LIMIT_BYTES - consumedBytes,
    0,
  );
  const consumedRatio = consumedBytes / FREE_PLAN_BANDWIDTH_LIMIT_BYTES;

  return {
    rollingWindowDays: ROLLING_WINDOW_DAYS,
    bandwidthLimitBytes: FREE_PLAN_BANDWIDTH_LIMIT_BYTES,
    consumedBytes,
    remainingBytes,
    consumedRatio,
    isWarning: consumedRatio >= WARNING_RATIO,
    isLimitReached: consumedBytes >= FREE_PLAN_BANDWIDTH_LIMIT_BYTES,
  };
}

export function formatFmpUsageSnapshot(snapshot: FmpUsageSnapshot): string {
  const consumedPercent = (snapshot.consumedRatio * 100).toFixed(1);

  return (
    `${formatBytes(snapshot.consumedBytes)} / ` +
    `${formatBytes(snapshot.bandwidthLimitBytes)} ` +
    `(${consumedPercent}%, remaining=${formatBytes(snapshot.remainingBytes)})`
  );
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  }

  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)}KB`;
  }

  return `${bytes}B`;
}
