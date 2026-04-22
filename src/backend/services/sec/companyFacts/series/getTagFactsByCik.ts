// src/backend/services/sec/companyFacts/series/getTagFactsByCik.ts

import { db } from "@/backend/config/db";
import type { FlatCompanyFactRow } from "@/backend/schemas/sec/companyFacts";

type GetTagFactsByCikInput = {
  cik: string;
  tags?: string[];
  taxonomy?: string;
  unit?: string;
  allowedForms?: string[];
};

export async function getTagFactsByCik(
  input: GetTagFactsByCikInput,
): Promise<FlatCompanyFactRow[]> {
  const { cik, tags, taxonomy, unit, allowedForms } = input;

  if (!cik) {
    return [];
  }

  const query = `
    SELECT
      cik,
      entity_name,
      taxonomy,
      tag,
      unit,
      label,
      description,
      val,
      start,
      "end",
      accn,
      fy,
      fp,
      form,
      filed,
      frame,
      workflow_type
    FROM sec_companyfact_raw
    WHERE cik = $1
      AND ($2::text IS NULL OR taxonomy = $2)
      AND ($3::text[] IS NULL OR tag = ANY($3::text[]))
      AND ($4::text IS NULL OR unit = $4)
      AND ($5::text[] IS NULL OR form = ANY($5::text[]))
      AND val IS NOT NULL
      AND "end" IS NOT NULL
    ORDER BY tag ASC, "end" ASC, filed ASC
  `;

  const params = [
    cik,
    taxonomy ?? null,
    tags && tags.length > 0 ? tags : null,
    unit ?? null,
    allowedForms && allowedForms.length > 0 ? allowedForms : null,
  ];

  const { rows } = await db.query<FlatCompanyFactRow>(query, params);

  return rows;
}
