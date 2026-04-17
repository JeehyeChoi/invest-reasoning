import { ENV } from "@/backend/config/env";
import { normalizeCikForSubmissions } from "@/backend/utils/sec";
import type { SecSubmissionsResponse } from "@/backend/schemas/sec";

const SEC_BASE_URL = "https://data.sec.gov";

function buildSecHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    "User-Agent": ENV.SEC_USER_AGENT,
    Accept: "application/json",
  };
}

export async function fetchFromSec<T = unknown>(path: string): Promise<T> {
  const url = `${SEC_BASE_URL}${path}`;

  const res = await fetch(url, {
    method: "GET",
    headers: buildSecHeaders(),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SEC request failed: ${res.status} ${text}`);
  }

  return (await res.json()) as T;
}

export async function fetchSecSubmissions(
  cik: string
): Promise<SecSubmissionsResponse> {
  const normalizedCik = normalizeCikForSubmissions(cik);

  return fetchFromSec<SecSubmissionsResponse>(
    `/submissions/CIK${normalizedCik}.json`
  );
}

export async function fetchSecCompanyFacts<T = unknown>(
  cik: string
): Promise<T> {
  const normalizedCik = normalizeCikForSubmissions(cik);

  return fetchFromSec<T>(
    `/api/xbrl/companyfacts/CIK${normalizedCik}.json`
  );
}
