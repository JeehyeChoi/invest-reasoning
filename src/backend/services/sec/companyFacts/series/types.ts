export type CompanyFactPeriodType =
  | "instant"
  | "quarterly"
  | "annual"
  | "other";

export type CompanyFactType =
  | "flow"
  | "instant"
  | "per_share"
  | "share_count";

export type BuiltTagSeriesRow = {
  cik: string;
  ticker: string | null;

  metric_key: string;
  fact_type: CompanyFactType;
  unit: string;
  val: number;

  start: string | null;
  end: string;
  filed: string | null;
  accn: string | null;
  fy: number | null;
  fp: string | null;
  form: string | null;

  display_frame: string | null;
  period_type: CompanyFactPeriodType;

  workflow_type: string | null;
};

export type BuildTagSeriesInput = {
  ticker: string | null;
  metricKey?: string | null;
  factType: CompanyFactType;
};
