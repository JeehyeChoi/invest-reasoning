export async function fetchSecDocument(
  secUrl: string
): Promise<string | null> {
  if (!secUrl) {
    return null;
  }

  try {
    const res = await fetch(secUrl, {
      method: "GET",
      headers: {
        "User-Agent": "geo-portfolio dev contact@example.com",
        Accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`SEC document fetch failed: ${res.status} ${text}`);
    }

    return await res.text();
  } catch (error) {
    console.error("[fetchFilingDocument] error:", error);
    return null;
  }
}
