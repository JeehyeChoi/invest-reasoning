import { db } from "@/backend/config/db";
import type { CompanyMetricSignProfile } from "@/backend/services/sec/companyFacts/series/fiscal/types";

export async function upsertCompanyMetricSignProfiles(input: {
  cik: string;
  rows: CompanyMetricSignProfile[];
}): Promise<void> {
  await db.query(
    `DELETE FROM public.sec_company_fiscal_metric_sign_profiles WHERE cik = $1`,
    [input.cik],
  );

  if (input.rows.length === 0) return;

  const values: unknown[] = [];
  const placeholders = input.rows.map((row, index) => {
    const offset = index * 18;

    values.push(
      row.cik,
      row.ticker,
      row.metricKey,
      row.tag,
      row.unit,
      row.signProfile,
      row.expectedSign,
      row.sampleCount,
      row.positiveCount,
      row.negativeCount,
      row.zeroCount,
      row.positiveRatio,
      row.negativeRatio,
      row.firstEnd,
      row.latestEnd,
      row.confidence,
      row.sourceScope,
      row.notes ? JSON.stringify(row.notes) : null,
    );

    return `(
      $${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4},
      $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8},
      $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12},
      $${offset + 13}, $${offset + 14}, $${offset + 15}, $${offset + 16},
      $${offset + 17}, $${offset + 18}::jsonb
    )`;
  });

  await db.query(
    `
    INSERT INTO public.sec_company_fiscal_metric_sign_profiles (
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
    )
    VALUES ${placeholders.join(",")}
    ON CONFLICT ON CONSTRAINT sec_company_fiscal_metric_sign_profiles_pk
    DO UPDATE SET
      ticker = EXCLUDED.ticker,
      sign_profile = EXCLUDED.sign_profile,
      expected_sign = EXCLUDED.expected_sign,
      sample_count = EXCLUDED.sample_count,
      positive_count = EXCLUDED.positive_count,
      negative_count = EXCLUDED.negative_count,
      zero_count = EXCLUDED.zero_count,
      positive_ratio = EXCLUDED.positive_ratio,
      negative_ratio = EXCLUDED.negative_ratio,
      first_end = EXCLUDED.first_end,
      latest_end = EXCLUDED.latest_end,
      confidence = EXCLUDED.confidence,
      source_scope = EXCLUDED.source_scope,
      notes = EXCLUDED.notes,
      updated_at = now()
    `,
    values,
  );
}
