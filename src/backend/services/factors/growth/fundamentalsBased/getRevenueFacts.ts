// backend/services/factors/fundamentalsBased/getRevenueFacts.ts

import { fetchSecCompanyFacts } from "@/backend/clients/sec";

export type SecCompanyFactsResponse = {
  facts?: {
    "us-gaap"?: Record<string, unknown>;
  };
};

export type RevenueFactPoint = {
  end: string;
  val: number;
  form?: string;
  filed?: string;
  fy?: number;
  fp?: string;
};

type RevenueFactUnitPointRaw = {
  end?: string;
  val?: number;
  form?: string;
  filed?: string;
  fy?: number;
  fp?: string;
};

const REVENUE_TAXONOMY_KEYS = [
  "Revenues",
  "SalesRevenueNet",
  "RevenueFromContractWithCustomerExcludingAssessedTax",
] as const;

function extractRevenueUnitPoints(
  data: SecCompanyFactsResponse
): RevenueFactUnitPointRaw[] {
  const usGaap = data.facts?.["us-gaap"];

  if (!usGaap || typeof usGaap !== "object") {
    return [];
  }

  for (const key of REVENUE_TAXONOMY_KEYS) {
    const candidate = usGaap[key] as
      | { units?: Record<string, RevenueFactUnitPointRaw[]> }
      | undefined;

    const usdPoints = candidate?.units?.USD;

    if (Array.isArray(usdPoints) && usdPoints.length > 0) {
      return usdPoints;
    }
  }

  return [];
}

function normalizeRevenuePoints(
  points: RevenueFactUnitPointRaw[]
): RevenueFactPoint[] {
  return points
    .filter(
      (point): point is Required<Pick<RevenueFactUnitPointRaw, "end" | "val">> &
        RevenueFactUnitPointRaw =>
        typeof point.end === "string" &&
        typeof point.val === "number" &&
        Number.isFinite(point.val)
    )
    .map((point) => ({
      end: point.end,
      val: point.val,
      form: point.form,
      filed: point.filed,
      fy: point.fy,
      fp: point.fp,
    }));
}

export async function getRevenueFacts(
  cik: string
): Promise<RevenueFactPoint[]> {
  const data = await fetchSecCompanyFacts<SecCompanyFactsResponse>(cik);
  const rawPoints = extractRevenueUnitPoints(data);
  return normalizeRevenuePoints(rawPoints);
}
