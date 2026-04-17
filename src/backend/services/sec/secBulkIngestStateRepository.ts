import { db } from "@/backend/config/db";

export type SecBulkDatasetKey = "companyfacts";

export type SecBulkIngestState = {
  dataset: SecBulkDatasetKey;
  archive_path: string | null;
  archive_mtime_iso: string | null;
  archive_file_size: number | null;
  archive_status: "idle" | "downloading" | "ready" | "failed";
  archive_error: string | null;
  archive_checked_at: string | null;
  ingest_status: "idle" | "running" | "completed" | "failed";
  ingest_error: string | null;
  ingest_started_at: string | null;
  ingest_completed_at: string | null;
  updated_at: string;
};

type UpsertSecBulkIngestStateInput = {
  dataset: SecBulkDatasetKey;
  archive_path?: string | null;
  archive_mtime_iso?: string | null;
  archive_file_size?: number | null;
  archive_status?: SecBulkIngestState["archive_status"];
  archive_error?: string | null;
  archive_checked_at?: string | null;
  ingest_status?: SecBulkIngestState["ingest_status"];
  ingest_error?: string | null;
  ingest_started_at?: string | null;
  ingest_completed_at?: string | null;
};

export async function getSecBulkIngestState(
  dataset: SecBulkDatasetKey
): Promise<SecBulkIngestState | null> {
  const result = await db.query<SecBulkIngestState>(
    `
      SELECT
        dataset,
        archive_path,
        archive_mtime_iso,
        archive_file_size,
        archive_status,
        archive_error,
        archive_checked_at,
        ingest_status,
        ingest_error,
        ingest_started_at,
        ingest_completed_at,
        updated_at
      FROM sec_bulk_ingest_state
      WHERE dataset = $1
    `,
    [dataset]
  );

  return result.rows[0] ?? null;
}
export async function upsertSecBulkIngestState(
  input: UpsertSecBulkIngestStateInput
): Promise<void> {
  await db.query(
    `
      INSERT INTO sec_bulk_ingest_state (
        dataset,
        archive_path,
        archive_mtime_iso,
        archive_file_size,
        archive_status,
        archive_error,
        archive_checked_at,
        ingest_status,
        ingest_error,
        ingest_started_at,
        ingest_completed_at,
        updated_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        COALESCE($5, 'idle'),
        $6,
        $7,
        COALESCE($8, 'idle'),
        $9,
        $10,
        $11,
        NOW()
      )
      ON CONFLICT (dataset)
      DO UPDATE SET
        archive_path = COALESCE(EXCLUDED.archive_path, sec_bulk_ingest_state.archive_path),
        archive_mtime_iso = COALESCE(EXCLUDED.archive_mtime_iso, sec_bulk_ingest_state.archive_mtime_iso),
        archive_file_size = COALESCE(EXCLUDED.archive_file_size, sec_bulk_ingest_state.archive_file_size),

        archive_status = CASE
          WHEN $5 IS NULL THEN sec_bulk_ingest_state.archive_status
          ELSE EXCLUDED.archive_status
        END,

        archive_error = CASE
          WHEN $6 IS NULL THEN sec_bulk_ingest_state.archive_error
          ELSE EXCLUDED.archive_error
        END,

        archive_checked_at = COALESCE(EXCLUDED.archive_checked_at, sec_bulk_ingest_state.archive_checked_at),

        ingest_status = CASE
          WHEN $8 IS NULL THEN sec_bulk_ingest_state.ingest_status
          ELSE EXCLUDED.ingest_status
        END,

        ingest_error = CASE
          WHEN $9 IS NULL THEN sec_bulk_ingest_state.ingest_error
          ELSE EXCLUDED.ingest_error
        END,

        ingest_started_at = COALESCE(EXCLUDED.ingest_started_at, sec_bulk_ingest_state.ingest_started_at),
        ingest_completed_at = COALESCE(EXCLUDED.ingest_completed_at, sec_bulk_ingest_state.ingest_completed_at),

        updated_at = NOW()
    `,
    [
      input.dataset,
      input.archive_path ?? null,
      input.archive_mtime_iso ?? null,
      input.archive_file_size ?? null,
      input.archive_status ?? null,
      input.archive_error ?? null,
      input.archive_checked_at ?? null,
      input.ingest_status ?? null,
      input.ingest_error ?? null,
      input.ingest_started_at ?? null,
      input.ingest_completed_at ?? null,
    ]
  );
}
