import type { SecBulkIngestState } from "../schemas/secBulkIngestState";

export async function fetchSecBulkIngestState(): Promise<SecBulkIngestState> {
  const response = await fetch("/api/internal/sec-bulk-ingest/state", {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to load SEC bulk state.");
  }

  const data = await response.json();
  return data.state;
}
