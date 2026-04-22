import { db } from "@/backend/config/db";
import type { FlatCompanyFactRow } from "@/backend/schemas/sec/companyFacts";

const UPSERT_BATCH_SIZE = 200;

const RAW_COLUMNS = [
  "cik",
  "entity_name",
  "taxonomy",
  "tag",
  "unit",
  "label",
  "description",
  "val",
  "start",
  "end",
  "accn",
  "fy",
  "fp",
  "form",
  "filed",
  "frame",
  "workflow_type",
] as const;

type RawColumn = (typeof RAW_COLUMNS)[number];

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
}

function getRowValues(row: FlatCompanyFactRow): unknown[] {
  const valuesByColumn: Record<RawColumn, unknown> = {
    cik: row.cik,
    entity_name: row.entity_name,
    taxonomy: row.taxonomy,
    tag: row.tag,
    unit: row.unit,
    label: row.label,
    description: row.description,
    val: row.val,
    start: row.start,
    end: row.end,
    accn: row.accn,
    fy: row.fy,
    fp: row.fp,
    form: row.form,
    filed: row.filed,
    frame: row.frame,
    workflow_type: row.workflow_type,
  };

  return RAW_COLUMNS.map((column) => valuesByColumn[column]);
}

function buildPlaceholders(rowCount: number, columnCount: number): string {
  const rows: string[] = [];

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const startIndex = rowIndex * columnCount;
    const params = Array.from(
      { length: columnCount },
      (_, columnIndex) => `$${startIndex + columnIndex + 1}`,
    );

    rows.push(`(${params.join(", ")})`);
  }

  return rows.join(", ");
}

async function upsertSecCompanyFactRowsChunk(
  rows: FlatCompanyFactRow[],
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const values = rows.flatMap(getRowValues);
  const placeholders = buildPlaceholders(rows.length, RAW_COLUMNS.length);

  const query = `
    INSERT INTO sec_companyfact_raw (
      ${RAW_COLUMNS.map((column) =>
        column === "end" ? `"end"` : column,
      ).join(",\n      ")}
    )
    VALUES ${placeholders}
    ON CONFLICT (cik, taxonomy, tag, unit, accn, start, "end")
    DO UPDATE SET
      entity_name = EXCLUDED.entity_name,
      label = EXCLUDED.label,
      description = EXCLUDED.description,
      val = EXCLUDED.val,
      fy = EXCLUDED.fy,
      fp = EXCLUDED.fp,
      form = EXCLUDED.form,
      filed = EXCLUDED.filed,
      frame = EXCLUDED.frame,
      workflow_type = EXCLUDED.workflow_type
  `;

  await db.query(query, values);
}

export async function upsertSecCompanyFactRows(
  rows: FlatCompanyFactRow[],
): Promise<void> {
  const chunks = chunkArray(rows, UPSERT_BATCH_SIZE);

  for (const chunk of chunks) {
    await upsertSecCompanyFactRowsChunk(chunk);
  }
}
