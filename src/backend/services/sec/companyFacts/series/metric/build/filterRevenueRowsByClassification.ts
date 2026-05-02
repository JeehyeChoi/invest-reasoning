import type { MetricBuildSourceRow, TickerClassificationContext } from "./types";
import type { CompanyFactsSeriesTagFamily } from "@/backend/services/sec/companyFacts/series/tagMeta";
import { COMPANY_FACTS_SERIES_TAG_META } from "@/backend/services/sec/companyFacts/series/tagMeta";

const CORE_REVENUE_FAMILIES = new Set<CompanyFactsSeriesTagFamily>([
  "revenue_core",
  "revenue_sales_split",
]);

export function filterRevenueRowsByClassification(input: {
  rows: MetricBuildSourceRow[];
  classification: TickerClassificationContext | null;
}): MetricBuildSourceRow[] {
  const allowedFamilies = getAllowedRevenueFamilies(input.classification);

  return input.rows.filter((row) => {
    if (row.metric_key !== "revenue") return true;

    const family = COMPANY_FACTS_SERIES_TAG_META[row.tag]?.tagFamily;
    if (!family) return true;

    return allowedFamilies.has(family);
  });
}

function getAllowedRevenueFamilies(
  classification: TickerClassificationContext | null,
): Set<CompanyFactsSeriesTagFamily> {
  const allowed = new Set(CORE_REVENUE_FAMILIES);
  const sector = normalize(classification?.sector);
  const industry = normalize(classification?.industry);

  if (sector === "financial services" || hasAny(industry, [
    "bank",
    "capital market",
    "credit service",
    "investment",
    "asset management",
  ])) {
    allowed.add("revenue_financial_net");
  }

  if (sector === "real estate" || industry.includes("reit")) {
    allowed.add("revenue_real_estate");
  }

  if (sector === "utilities" || industry.includes("utilities")) {
    allowed.add("revenue_utility");
  }

  if (
    sector === "healthcare" &&
    hasAny(industry, ["care facilities", "hospital", "medical"])
  ) {
    allowed.add("revenue_healthcare");
  }

  return allowed;
}

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function hasAny(value: string, patterns: string[]): boolean {
  return patterns.some((pattern) => value.includes(pattern));
}
