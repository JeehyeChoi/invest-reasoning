import type { CompanyFactType } from "@/backend/services/sec/companyFacts/series/types";

export type CompanyFactTagMeta = {
  metricKey: string;
  priority?: number;
  factType: CompanyFactType;
};

export type CompanyFactTagSeriesRow = {
  cik: string;
  ticker: string | null;
  tag: string;
  metric_key: string;
  priority: number;
  fact_type: CompanyFactType;
  unit: string;
  val: number;
  start: string | Date | null;
  end: string | Date;
  filed: string | Date | null;
  accn: string | null;
  fy: number | null;
  fp: string | null;
  form: string | null;
  frame: string | null;
  duration_days: number | null;
  workflow_type: string | null;
};
