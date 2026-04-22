// backend/services/sec/flattenCompanyFacts.ts

import type {
  CompanyFactsDocument,
  FlatCompanyFactRow,
} from "@/backend/schemas/sec/companyFacts";

export function flattenCompanyFacts(
  doc: CompanyFactsDocument,
  options?: {
    workflowType?: string;
    keepTags?: Set<string>;
  }
): FlatCompanyFactRow[] {
  if (!doc || !doc.facts) {
    return [];
  }

	const rawCik =
		typeof doc.cik === "string"
			? doc.cik.trim()
			: typeof doc.cik === "number"
			? String(doc.cik)
			: "";

	const cik = rawCik ? rawCik.padStart(10, "0") : "";

	if (!cik) {
		return [];
	}

  const entityName =
    typeof doc.entityName === "string"
      ? doc.entityName
      : doc.entityName != null
      ? String(doc.entityName)
      : null;

  const workflowType = options?.workflowType ?? "sec_companyfacts";

  const keepTags = options?.keepTags;

  const rows: FlatCompanyFactRow[] = [];

  for (const [taxonomy, tags] of Object.entries(doc.facts)) {
    if (!tags) continue;

    for (const [tag, tagData] of Object.entries(tags)) {
      if (!tagData || !tagData.units) continue;

      // 선택적으로 특정 tag만 유지
      if (keepTags && !keepTags.has(tag)) {
        continue;
      }

      const label =
        typeof tagData.label === "string" ? tagData.label : null;

      const description =
        typeof tagData.description === "string"
          ? tagData.description
          : null;

      for (const [unit, points] of Object.entries(tagData.units)) {
        if (!Array.isArray(points)) continue;

        for (const point of points) {
          if (!point || typeof point !== "object") continue;

          const val =
            typeof point.val === "number" ? point.val : null;

          const start =
            typeof point.start === "string" ? point.start : null;

          const end =
            typeof point.end === "string" ? point.end : null;

          const accn =
            typeof point.accn === "string" ? point.accn : null;

          const fy =
            typeof point.fy === "number" ? point.fy : null;

          const fp =
            typeof point.fp === "string" ? point.fp : null;

          const form =
            typeof point.form === "string" ? point.form : null;

          const filed =
            typeof point.filed === "string" ? point.filed : null;

          const frame =
            typeof point.frame === "string" ? point.frame : null;

          rows.push({
            cik,
            entity_name: entityName,

            taxonomy,
            tag,
            unit,

            label,
            description,

            val,
            start,
            end,

            accn,
            fy,
            fp,
            form,
            filed,
            frame,

            workflow_type: workflowType, // ✅ 여기
          });
        }
      }
    }
  }

  return rows;
}
