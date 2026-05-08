import type { FredMacroSeriesOverview } from "@/shared/macro/fred";

export async function fetchFredMacroSeriesOverview(): Promise<FredMacroSeriesOverview> {
  const response = await fetch("/api/macro/fred/series");

  if (!response.ok) {
    throw new Error("Failed to fetch FRED macro series.");
  }

  return response.json();
}
