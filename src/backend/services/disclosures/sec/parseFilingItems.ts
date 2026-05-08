// backend/services/disclosures/sec/parseFilingItems.ts

import type { SecDisclosureFilingItemEntry } from "@/shared/disclosures/sec/types";
import type { FilingForm } from "@/shared/disclosures/sec/constants";
import { normalizeFilingText } from "@/backend/utils/filingText";

export type ParsedFilingItem = SecDisclosureFilingItemEntry & {
  body: string;
};

type ParseFilingItemsOptions = {
  form?: FilingForm | string;
};

type FilingItemHeading = {
  itemCode: string;
  itemTitle: string | null;
  index: number;
};

function normalizeItemTitle(rawTitle: string): string | null {
  const itemTitle = rawTitle
    .replace(/\s+/g, " ")
    .replace(/\.\s*$/, "")
    .trim();

  return itemTitle || null;
}

function parseCurrentReportItemHeadings(text: string): FilingItemHeading[] {
  const regex =
    /(?:^|\n)\s*Item\s+(\d+\.\d+)\.?\s*([^\n]*?)\s*(?=\n|$)/gim;

  return Array.from(text.matchAll(regex))
    .map((match) => {
      const itemCode = match[1]?.trim();

      if (!itemCode || match.index === undefined) {
        return null;
      }

      return {
        itemCode,
        itemTitle: normalizeItemTitle(match[2]?.trim() ?? ""),
        index: match.index,
      };
    })
    .filter((item): item is FilingItemHeading => item !== null);
}

function parsePeriodicReportItemHeadings(text: string): FilingItemHeading[] {
  const regex =
    /(?:^|\n)\s*(?:PART\s+[IVX]+\.?\s+)?Item\s+(\d{1,2}[A-Z]?(?:\.\d+)?)\.?\s+([^\n]{0,180})\s*(?=\n|$)/gim;

  return Array.from(text.matchAll(regex))
    .map((match) => {
      const itemCode = match[1]?.trim().toUpperCase();

      if (!itemCode || match.index === undefined) {
        return null;
      }

      return {
        itemCode,
        itemTitle: normalizeItemTitle(match[2]?.trim() ?? ""),
        index: match.index,
      };
    })
    .filter((item): item is FilingItemHeading => item !== null);
}

function parseItemHeadings(
  text: string,
  form?: FilingForm | string
): FilingItemHeading[] {
  if (form === "8-K") {
    return parseCurrentReportItemHeadings(text);
  }

  const periodicHeadings = parsePeriodicReportItemHeadings(text);

  if (periodicHeadings.length > 0) {
    return periodicHeadings;
  }

  return parseCurrentReportItemHeadings(text);
}

export function parseFilingItems(
  rawDocument: string,
  options: ParseFilingItemsOptions = {}
): ParsedFilingItem[] {
  if (!rawDocument) {
    return [];
  }

  const text = normalizeFilingText(rawDocument);
  const headings = parseItemHeadings(text, options.form);

  const results: ParsedFilingItem[] = [];

  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i];
    const start = heading.index;

    const end =
      i + 1 < headings.length
        ? headings[i + 1].index
        : text.length;

    const body = text.slice(start, end).trim();

    results.push({
      itemCode: heading.itemCode,
      itemTitle: heading.itemTitle,
      body,
    });
  }

  return results;
}
