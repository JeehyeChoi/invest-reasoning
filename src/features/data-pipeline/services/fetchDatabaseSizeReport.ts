import type { DatabaseSizeReport } from "../schemas/databaseSizeReport";

export async function fetchDatabaseSizeReport(): Promise<DatabaseSizeReport> {
  const response = await fetch("/api/internal/database/size", {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to load database size report.");
  }

  return response.json();
}
