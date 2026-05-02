import { db } from "@/backend/config/db";
import type {
  CompanyMetricExpectedSign,
  CompanyMetricSignProfile,
  CompanyMetricSignProfileKind,
  CompanyMetricSignProfileSourceScope,
} from "@/backend/services/sec/companyFacts/series/fiscal/types";

type CompanyMetricSignProfileRow = {
  cik: string;
  ticker: string | null;
  metric_key: string;
  tag: string;
  unit: string;
  sign_profile: CompanyMetricSignProfileKind;
  expected_sign: CompanyMetricExpectedSign;
  sample_count: number;
  positive_count: number;
  negative_count: number;
  zero_count: number;
  positive_ratio: number | null;
  negative_ratio: number | null;
  first_end: Date | string | null;
  latest_end: Date | string | null;
  confidence: number;
  source_scope: CompanyMetricSignProfileSourceScope;
  notes: Record<string, unknown> | null;
};

export async function loadCompanyMetricSignProfiles(
  cik: string,
): Promise<CompanyMetricSignProfile[]> {
  const result = await db.query<CompanyMetricSignProfileRow>(
    `
    SELECT
      cik,
      ticker,
      metric_key,
      tag,
      unit,
      sign_profile,
      expected_sign,
      sample_count,
      positive_count,
      negative_count,
      zero_count,
      positive_ratio,
      negative_ratio,
      first_end,
      latest_end,
      confidence,
      source_scope,
      notes
    FROM public.sec_company_fiscal_metric_sign_profiles
    WHERE cik = $1
    ORDER BY metric_key ASC, tag ASC, unit ASC
    `,
    [cik],
  );

  return result.rows.map((row) => ({
    cik: row.cik,
    ticker: row.ticker,
    metricKey: row.metric_key,
    tag: row.tag,
    unit: row.unit,
    signProfile: row.sign_profile,
    expectedSign: row.expected_sign,
    sampleCount: Number(row.sample_count),
    positiveCount: Number(row.positive_count),
    negativeCount: Number(row.negative_count),
    zeroCount: Number(row.zero_count),
    positiveRatio:
      row.positive_ratio == null ? null : Number(row.positive_ratio),
    negativeRatio:
      row.negative_ratio == null ? null : Number(row.negative_ratio),
    firstEnd: toDateKey(row.first_end),
    latestEnd: toDateKey(row.latest_end),
    confidence: Number(row.confidence),
    sourceScope: row.source_scope,
    notes: row.notes,
  }));
}

function toDateKey(value: Date | string | null): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}
