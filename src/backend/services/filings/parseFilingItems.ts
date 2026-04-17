// backend/services/filings/parseFilingItems.ts

import type { FilingItemEntry } from "@/features/filings/schemas/recentFilings";
import { normalizeFilingText } from "@/backend/utils/filingText";

export type ParsedFilingItem = FilingItemEntry & {
  body: string;
};

export function parseFilingItems(rawDocument: string): ParsedFilingItem[] {
  if (!rawDocument) {
    return [];
  }

  const text = normalizeFilingText(rawDocument);

  const regex =
    /(?:^|\n)\s*Item\s+(\d+\.\d+)\.?\s*([^\n]*?)\s*(?=\n|$)/gim;

  const matches = Array.from(text.matchAll(regex));

  const results: ParsedFilingItem[] = [];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];

    const itemCode = match[1]?.trim();
    const rawTitle = match[2]?.trim() ?? "";

    if (!itemCode || match.index === undefined) {
      continue;
    }

    const itemTitle = rawTitle
      .replace(/\s+/g, " ")
      .replace(/\.\s*$/, "")
      .trim();

    const start = match.index;

    const end =
      i + 1 < matches.length && matches[i + 1].index !== undefined
        ? matches[i + 1].index!
        : text.length;

    const body = text.slice(start, end).trim();

    results.push({
      itemCode,
      itemTitle: itemTitle || null,
      body,
    });
  }

  return results;
}
