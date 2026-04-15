// backend/services/filings/parseFilingExhibits.ts

import type { FilingExhibitEntry } from "@/features/filings/schemas/recentFilings";
import { normalizeFilingText } from "@/backend/utils/filingText";

function extractExhibitSection(text: string): string | null {
  const startMatch = text.match(/Exhibit\s+No\.?\s+Description/i);

  if (!startMatch || startMatch.index === undefined) {
    return null;
  }

  const startIndex = startMatch.index;

  // 보통 exhibit 섹션은 끝쪽에 있고, 다음 큰 섹션이 없을 수도 있음
  // 일단 시작점부터 끝까지 사용
  return text.slice(startIndex).trim();
}

export function parseFilingExhibits(rawDocument: string): FilingExhibitEntry[] {
  if (!rawDocument) {
    return [];
  }

  const text = normalizeFilingText(rawDocument);
  const exhibitSection = extractExhibitSection(text);

  if (!exhibitSection) {
    return [];
  }

  const regex = /(?:^|\n)\s*(\d+(?:\.\d+)?)\s+([^\n]+?)(?=\n|$)/g;

  const seen = new Set<string>();
  const results: FilingExhibitEntry[] = [];

  for (const match of exhibitSection.matchAll(regex)) {
    const exhibitNo = match[1]?.trim();
    const rawDescription = match[2]?.trim() ?? "";

    if (!exhibitNo) {
      continue;
    }

    const description = rawDescription
      .replace(/\s+/g, " ")
      .replace(/\.\s*$/, "")
      .trim();

    if (!description || description.length < 3) {
      continue;
    }

    const key = `${exhibitNo}::${description}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    results.push({
      exhibitNo,
      description: description || null,
    });
  }

  return results;
}
