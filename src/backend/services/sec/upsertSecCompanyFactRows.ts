import { db } from "@/backend/config/db";
import type { FlatCompanyFactRow } from "@/backend/schemas/sec/companyFacts";

const UPSERT_BATCH_SIZE = 200;

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
}

async function upsertSecCompanyFactRowsChunk(
  rows: FlatCompanyFactRow[]
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const values: unknown[] = [];
  const placeholders: string[] = [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const offset = i * 17;

    placeholders.push(`(
      $${offset + 1},
      $${offset + 2},
      $${offset + 3},
      $${offset + 4},
      $${offset + 5},
      $${offset + 6},
      $${offset + 7},
      $${offset + 8},
      $${offset + 9},
      $${offset + 10},
      $${offset + 11},
      $${offset + 12},
      $${offset + 13},
      $${offset + 14},
      $${offset + 15},
      $${offset + 16},
      $${offset + 17}
    )`);

    values.push(
      row.cik,
      row.entity_name,
      row.taxonomy,
      row.tag,
      row.unit,
      row.label,
      row.description,
      row.val,
      row.start,
      row.end,
      row.accn,
      row.fy,
      row.fp,
      row.form,
      row.filed,
      row.frame,
      row.workflow_type
    );
  }

  await db.query(
    `
      INSERT INTO sec_companyfact_raw (
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
      )
      VALUES ${placeholders.join(", ")}
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
    `,
    values
  );
}

export async function upsertSecCompanyFactRows(
  rows: FlatCompanyFactRow[]
): Promise<void> {
  const chunks = chunkArray(rows, UPSERT_BATCH_SIZE);

  for (const chunk of chunks) {
    await upsertSecCompanyFactRowsChunk(chunk);
  }
}
