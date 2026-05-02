export type SecBulkIngestState = {
  dataset: string;
  archive_path: string | null;
  archive_mtime_iso: string | null;
  archive_file_size: string | number | null;
  archive_status: "idle" | "downloading" | "ready" | "failed";
  archive_error: string | null;
  archive_checked_at: string | null;
  ingest_status: "idle" | "running" | "completed" | "failed";
  ingest_error: string | null;
  ingest_started_at: string | null;
  ingest_completed_at: string | null;
  updated_at: string;
};
