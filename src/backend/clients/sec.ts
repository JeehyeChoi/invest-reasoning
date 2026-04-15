// backend/clients/sec.ts
import {
  normalizeCikForSubmissions,
  normalizeCikForArchivePath,
} from "@/backend/utils/sec";
import type { SecSubmissionsResponse } from "@/backend/schemas/sec";

const SEC_BASE_URL = "https://data.sec.gov";

function buildSecHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    // ⚠️ 실제 배포 시 반드시 수정
    "User-Agent": "geo-portfolio dev contact@example.com",
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
