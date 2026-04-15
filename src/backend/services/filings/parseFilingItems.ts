// backend/services/filings/parseFilingItems.ts

import type { FilingItemEntry } from "@/features/filings/schemas/recentFilings";
import { normalizeFilingText } from "@/backend/utils/filingText";

export function parseFilingItems(rawDocument: string): FilingItemEntry[] {
  if (!rawDocument) {
    return [];
  }

  const text = normalizeFilingText(rawDocument);

  /**
   * 줄 단위 파싱:
   * Item 2.02 Results of Operations and Financial Condition.
   * Item 9.01 Financial Statements and Exhibits.
   */
  const regex = /(?:^|\n)\s*Item\s+(\d+\.\d+)\s+([^\n]+?)\s*(?=\n|$)/gim;

  const seen = new Set<string>();
  const results: FilingItemEntry[] = [];

  for (const match of text.matchAll(regex)) {
    const itemCode = match[1]?.trim();
    const rawTitle = match[2]?.trim() ?? "";

    if (!itemCode) {
      continue;
    }

    const itemTitle = rawTitle
      .replace(/\s+/g, " ")
      .replace(/\.\s*$/, "")
      .trim();

    const key = `${itemCode}::${itemTitle}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    results.push({
      itemCode,
      itemTitle: itemTitle || null,
    });
  }

  return results;
}
