import type { MetricBuildCandidate } from "@/backend/services/sec/companyFacts/series/metric/build/types";
import type { CompanyFactTagSeriesRow } from "@/backend/services/sec/companyFacts/series/tag/types";

export type InstantSourceRow = CompanyFactTagSeriesRow & {
  priority?: number | null;
};

export type InstantMetricCandidate = MetricBuildCandidate;
