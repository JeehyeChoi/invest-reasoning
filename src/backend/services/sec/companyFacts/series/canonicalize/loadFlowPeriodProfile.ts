import { db } from "@/backend/config/db";
import type {
  FlowPeriodProfile,
  FlowPeriodOutlierCluster,
} from "@/backend/services/sec/companyFacts/series/canonicalize/flowPeriod";

type DurationRow = {
  duration_days: number;
  n: number;
};

type PeriodKey = "threeMonth" | "sixMonth" | "nineMonth" | "twelveMonth";

const GLOBAL_ANCHORS: Record<PeriodKey, number> = {
  threeMonth: 91,
  sixMonth: 182,
  nineMonth: 273,
  twelveMonth: 365,
};

const TOLERANCE_BY_PERIOD: Record<PeriodKey, number> = {
  threeMonth: 15,
  sixMonth: 15,
  nineMonth: 15,
  twelveMonth: 20,
};

const MIN_CLUSTER_COUNT = 2;
const OUTLIER_MERGE_GAP = 15;

export async function loadFlowPeriodProfile(
  cik: string,
): Promise<FlowPeriodProfile | null> {
  const query = `
    WITH target_tags AS (
      SELECT *
      FROM (
        VALUES
          ('Revenues', 'revenue', 1),
          ('RevenueFromContractWithCustomerExcludingAssessedTax', 'revenue', 2),
          ('SalesRevenueNet', 'revenue', 3),
          ('SalesRevenueGoodsNet', 'revenue', 4),
          ('SalesRevenueServicesNet', 'revenue', 5),
          ('NetIncomeLoss', 'net_income', 1),
          ('ProfitLoss', 'net_income', 2)
      ) AS t(tag, metric_key, priority)
    ),
    base AS (
      SELECT
        r.tag,
        r.start,
        r."end",
        r.filed,
        (r."end"::date - r.start::date + 1) AS duration_days
      FROM sec_companyfact_raw r
      JOIN target_tags tt
        ON r.tag = tt.tag
      WHERE r.cik = $1
        AND r.start IS NOT NULL
    ),
    deduped AS (
      SELECT DISTINCT ON (tag, start, "end")
        duration_days
      FROM base
      ORDER BY tag, start, "end", filed DESC
    )
    SELECT
      duration_days,
      COUNT(*)::int AS n
    FROM deduped
    GROUP BY duration_days
    ORDER BY duration_days;
  `;

  const result = await db.query(query, [cik]);

  const rows: DurationRow[] = result.rows.map((row: Record<string, unknown>) => ({
    duration_days: Number(row.duration_days),
    n: Number(row.n),
  }));

  if (rows.length === 0) {
    return null;
  }

  const buckets = assignRowsToClosestAnchors(rows);

  const threeMonth = buildRangeFromBucket(
    buckets.threeMonth,
    TOLERANCE_BY_PERIOD.threeMonth,
  );

  const sixMonth = buildRangeFromBucket(
    buckets.sixMonth,
    TOLERANCE_BY_PERIOD.sixMonth,
  );

  const nineMonth = buildRangeFromBucket(
    buckets.nineMonth,
    TOLERANCE_BY_PERIOD.nineMonth,
  );

  const twelveMonth = buildRangeFromBucket(
    buckets.twelveMonth,
    TOLERANCE_BY_PERIOD.twelveMonth,
  );

  const consumedDurations = new Set<number>();

  markConsumedDurations(rows, threeMonth, consumedDurations);
  markConsumedDurations(rows, sixMonth, consumedDurations);
  markConsumedDurations(rows, nineMonth, consumedDurations);
  markConsumedDurations(rows, twelveMonth, consumedDurations);

  const outlierSourceRows = rows.filter(
    (row) => !consumedDurations.has(row.duration_days),
  );

  const outlierClusters = buildOutlierClusters(outlierSourceRows);

  const profile: FlowPeriodProfile = {
    threeMonth,
    sixMonth,
    nineMonth,
    twelveMonth,
    outlierClusters,
  };

  if (
    !threeMonth &&
    !sixMonth &&
    !nineMonth &&
    !twelveMonth &&
    outlierClusters.length === 0
  ) {
    return null;
  }

  return profile;
}

function assignRowsToClosestAnchors(
  rows: DurationRow[],
): Record<PeriodKey, DurationRow[]> {
  const buckets: Record<PeriodKey, DurationRow[]> = {
    threeMonth: [],
    sixMonth: [],
    nineMonth: [],
    twelveMonth: [],
  };

  for (const row of rows) {
    const closest = findClosestAnchor(row.duration_days);
    buckets[closest].push(row);
  }

  return buckets;
}

function findClosestAnchor(durationDays: number): PeriodKey {
  let bestKey: PeriodKey = "threeMonth";
  let bestDiff = Number.POSITIVE_INFINITY;

  for (const key of Object.keys(GLOBAL_ANCHORS) as PeriodKey[]) {
    const diff = Math.abs(durationDays - GLOBAL_ANCHORS[key]);

    if (diff < bestDiff) {
      bestDiff = diff;
      bestKey = key;
    }
  }

  return bestKey;
}

function buildRangeFromBucket(
  rows: DurationRow[],
  tolerance: number,
): { min: number; max: number } | null {
  if (rows.length === 0) {
    return null;
  }

  const center = findModeDuration(rows);
  const inCluster = rows.filter(
    (row) => Math.abs(row.duration_days - center) <= tolerance,
  );

  const clusterCount = inCluster.reduce((sum, row) => sum + row.n, 0);

  if (clusterCount < MIN_CLUSTER_COUNT) {
    return null;
  }

  const min = Math.min(...inCluster.map((row) => row.duration_days));
  const max = Math.max(...inCluster.map((row) => row.duration_days));

  return { min, max };
}

function findModeDuration(rows: DurationRow[]): number {
  let best = rows[0];

  for (const row of rows) {
    if (row.n > best.n) {
      best = row;
      continue;
    }

    if (row.n === best.n && row.duration_days < best.duration_days) {
      best = row;
    }
  }

  return best.duration_days;
}

function markConsumedDurations(
  rows: DurationRow[],
  range: { min: number; max: number } | null | undefined,
  consumed: Set<number>,
) {
  if (!range) {
    return;
  }

  for (const row of rows) {
    if (
      row.duration_days >= range.min &&
      row.duration_days <= range.max
    ) {
      consumed.add(row.duration_days);
    }
  }
}

function buildOutlierClusters(rows: DurationRow[]): FlowPeriodOutlierCluster[] {
  if (rows.length === 0) {
    return [];
  }

  const sorted = [...rows].sort((a, b) => a.duration_days - b.duration_days);
  const groups: DurationRow[][] = [];

  let currentGroup: DurationRow[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const current = sorted[i];

    if (current.duration_days - prev.duration_days <= OUTLIER_MERGE_GAP) {
      currentGroup.push(current);
    } else {
      groups.push(currentGroup);
      currentGroup = [current];
    }
  }

  groups.push(currentGroup);

  return groups
    .map((group) => {
      const center = findModeDuration(group);
      const min = Math.min(...group.map((row) => row.duration_days));
      const max = Math.max(...group.map((row) => row.duration_days));
      const count = group.reduce((sum, row) => sum + row.n, 0);

      return {
        center,
        min,
        max,
        count,
      };
    })
    .filter((cluster) => cluster.count >= MIN_CLUSTER_COUNT)
    .sort((a, b) => a.min - b.min);
}
