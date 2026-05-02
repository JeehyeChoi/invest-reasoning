import { db } from "@/backend/config/db";
import type { CompanyFactType } from "@/backend/services/sec/companyFacts/series/types";
import type { CompanyFactTagSeriesRow } from "@/backend/services/sec/companyFacts/series/tag/types";

export async function getTagSeriesByCik(input: {
  cik: string;
  metricKey?: string;
}): Promise<CompanyFactTagSeriesRow[]> {
  const values: unknown[] = [input.cik];

  const metricFilter = input.metricKey
    ? `AND metric_key = $${values.push(input.metricKey)}`
    : "";

	const result = await db.query(
		`
		SELECT
			cik,
			ticker,
			tag,
			metric_key,
			priority,
			fact_type,
			unit,
			val,
			start,
			"end",
			filed,
			accn,
			fy,
			fp,
			form,
			frame,
			duration_days,
			workflow_type
		FROM public.sec_companyfact_tag_series
		WHERE cik = $1
			${metricFilter}
		ORDER BY
			metric_key ASC,
			tag ASC,
			"end" ASC,
			start ASC NULLS FIRST,
			filed ASC NULLS FIRST,
			accn ASC NULLS FIRST
		`,
		values,
	);

	return result.rows.map((row) => ({
		cik: row.cik,
		entity_name: null,
		taxonomy: "us-gaap",

		ticker: row.ticker,
		tag: row.tag,
		metric_key: row.metric_key,
		priority: row.priority,
		fact_type: row.fact_type as CompanyFactType,

		unit: row.unit,
		label: null,
		description: null,
		val: Number(row.val),

		start: row.start,
		end: row.end,
		filed: row.filed,
		accn: row.accn,
		fy: row.fy,
		fp: row.fp,
		form: row.form,

		frame: row.frame,
		duration_days: row.duration_days === null ? null : Number(row.duration_days),
		workflow_type: row.workflow_type,
	}));

}
