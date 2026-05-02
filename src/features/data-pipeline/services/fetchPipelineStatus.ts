import type { PipelineStatus } from "@/shared/data-pipeline/status";

export async function fetchPipelineStatus(): Promise<PipelineStatus> {
  const response = await fetch("/api/internal/data-pipeline/status", {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to load pipeline status.");
  }

  return response.json();
}
