import { ENV } from "@/backend/config/env";

const SEC_ARCHIVES_BASE_URL = "https://www.sec.gov/Archives";

export type SecBulkDataset = "companyfacts" | "submissions";

function buildSecBulkHeaders(): HeadersInit {
  return {
    "User-Agent": ENV.SEC_USER_AGENT,
    Accept: "application/zip, application/octet-stream, */*",
  };
}

export function buildSecBulkArchiveUrl(dataset: SecBulkDataset): string {
  switch (dataset) {
    case "companyfacts":
      return `${SEC_ARCHIVES_BASE_URL}/edgar/daily-index/xbrl/companyfacts.zip`;
    case "submissions":
      return `${SEC_ARCHIVES_BASE_URL}/edgar/daily-index/bulkdata/submissions.zip`;
    default: {
      const exhaustiveCheck: never = dataset;
      throw new Error(`Unsupported SEC bulk dataset: ${exhaustiveCheck}`);
    }
  }
}

export async function downloadSecBulkArchive(
  dataset: SecBulkDataset
): Promise<ArrayBuffer> {
  const url = buildSecBulkArchiveUrl(dataset);

  const res = await fetch(url, {
    method: "GET",
    headers: buildSecBulkHeaders(),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `SEC bulk download failed: ${res.status} ${res.statusText} | ${url} | ${text}`
    );
  }

  return await res.arrayBuffer();
}
