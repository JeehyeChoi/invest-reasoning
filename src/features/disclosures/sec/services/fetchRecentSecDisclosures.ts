// features/disclosures/sec/services/fetchRecentSecDisclosures.ts

import type {
  RecentSecDisclosuresRequest,
  RecentSecDisclosuresResponse,
} from "@/shared/disclosures/sec/types";

export async function fetchRecentSecDisclosures(
  input: RecentSecDisclosuresRequest
): Promise<RecentSecDisclosuresResponse> {
  const res = await fetch("/api/disclosures/sec", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch recent filings: ${res.status} ${text}`);
  }

  const data = (await res.json()) as RecentSecDisclosuresResponse;

  return {
    items: data.items ?? [],
  };
}
