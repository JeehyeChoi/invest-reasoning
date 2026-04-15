// features/filings/services/fetchRecentFilings.ts

import type {
  RecentFilingsRequest,
  RecentFilingsResponse,
} from "../schemas/recentFilings";

export async function fetchRecentFilings(
  input: RecentFilingsRequest
): Promise<RecentFilingsResponse> {
  const res = await fetch("/api/filings", {
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

  const data = (await res.json()) as RecentFilingsResponse;

  return {
    items: data.items ?? [],
  };
}
