import { db } from "@/backend/config/db";
import type { BuiltTagSeriesRow } from "@/backend/services/sec/companyFacts/series/types";

function normalizeKeyPart(value: string | Date | null | undefined): string {
  if (value == null) {
    return "NULL";
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  const text = String(value);

  // YYYY-MM-DD or ISO date-like string -> normalize to YYYY-MM-DD
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(text)) {
    return parsed.toISOString().slice(0, 10);
  }

  return text;
}

function buildUpsertConflictKey(row: BuiltTagSeriesRow): string {
  return [
    normalizeKeyPart(row.cik),
    normalizeKeyPart(row.metric_key),
    normalizeKeyPart(row.period_type),
    normalizeKeyPart(row.display_frame),
    normalizeKeyPart(row.start),
    normalizeKeyPart(row.end),
  ].join("__");
}

function isReconstructedRow(row: BuiltTagSeriesRow): boolean {
  return row.workflow_type === "sec_companyfacts_reconstructed_v1";
}

function choosePreferredRow(
  existing: BuiltTagSeriesRow,
  candidate: BuiltTagSeriesRow,
): BuiltTagSeriesRow {
  const existingIsReconstructed = isReconstructedRow(existing);
  const candidateIsReconstructed = isReconstructedRow(candidate);

  // Prefer direct/raw over reconstructed
  if (existingIsReconstructed !== candidateIsReconstructed) {
    return existingIsReconstructed ? candidate : existing;
  }

  const existingFiled = existing.filed ? new Date(existing.filed).getTime() : 0;
  const candidateFiled = candidate.filed ? new Date(candidate.filed).getTime() : 0;

  if (candidateFiled !== existingFiled) {
    return candidateFiled > existingFiled ? candidate : existing;
  }

  // If filed is tied, prefer row with accn (more concrete source identity)
  if ((existing.accn ?? "") !== (candidate.accn ?? "")) {
    return candidate.accn ? candidate : existing;
  }

  return existing;
}

function dedupeRowsForUpsert(rows: BuiltTagSeriesRow[]): BuiltTagSeriesRow[] {
  const deduped = new Map<string, BuiltTagSeriesRow>();

  for (const row of rows) {
    const key = buildUpsertConflictKey(row);
    const existing = deduped.get(key);

    if (!existing) {
      deduped.set(key, row);
      continue;
    }

    deduped.set(key, choosePreferredRow(existing, row));
  }

  return Array.from(deduped.values());
}

function findDuplicateConflictGroups(
  rows: BuiltTagSeriesRow[],
): BuiltTagSeriesRow[][] {
  const groups = new Map<string, BuiltTagSeriesRow[]>();

  for (const row of rows) {
    const key = buildUpsertConflictKey(row);
    const existing = groups.get(key) ?? [];
    existing.push(row);
    groups.set(key, existing);
  }

  return Array.from(groups.values()).filter((group) => group.length > 1);
}

export async function upsertCompanyFactSeriesRows(
  rows: BuiltTagSeriesRow[],
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const dedupedRows = dedupeRowsForUpsert(rows);

  const duplicateGroups = findDuplicateConflictGroups(dedupedRows);
  if (duplicateGroups.length > 0) {
    console.warn(
      `[series] duplicate conflict groups after dedupe: ${duplicateGroups.length}`,
    );

    for (const group of duplicateGroups.slice(0, 10)) {
      console.warn(
        "[series] duplicate group",
        group.map((row) => ({
          cik: row.cik,
          metric_key: row.metric_key,
          period_type: row.period_type,
          display_frame: row.display_frame,
          start: row.start,
          end: row.end,
          filed: row.filed,
          val: row.val,
          accn: row.accn,
          fy: row.fy,
          fp: row.fp,
          form: row.form,
          workflow_type: row.workflow_type,
        })),
      );
    }

    throw new Error("duplicate conflict groups remain after dedupe");
  }

  if (dedupedRows.length === 0) {
    return;
  }

  const values: unknown[] = [];
	const placeholders = dedupedRows.map((row, index) => {
		const offset = index * 16;

		values.push(
			row.cik,
			row.ticker,
			row.metric_key,
			row.fact_type,
			row.period_type,
			row.display_frame,
			row.unit,
			row.val,
			row.start,
			row.end,
			row.filed,
			row.accn,
			row.fy,
			row.fp,
			row.form,
			row.workflow_type,
		);

		return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13}, $${offset + 14}, $${offset + 15}, $${offset + 16})`;
	});

  const query = `
    INSERT INTO sec_companyfact_series (
      cik,
      ticker,
      metric_key,
      fact_type,
      period_type,
      display_frame,
      unit,
      val,
      start,
      "end",
      filed,
      accn,
      fy,
      fp,
      form,
			workflow_type
    )
    VALUES ${placeholders.join(",\n")}
    ON CONFLICT (cik, metric_key, period_type, display_frame, start, "end")
    DO UPDATE SET
      ticker = EXCLUDED.ticker,
      fact_type = EXCLUDED.fact_type,
      unit = EXCLUDED.unit,
      val = EXCLUDED.val,
      filed = EXCLUDED.filed,
      accn = EXCLUDED.accn,
      fy = EXCLUDED.fy,
      fp = EXCLUDED.fp,
      form = EXCLUDED.form,
			workflow_type = EXCLUDED.workflow_type
  `;

  await db.query(query, values);
}
