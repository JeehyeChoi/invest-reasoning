// backend/services/filings/parseFilingExhibits.ts

import type { FilingExhibitEntry } from "@/features/filings/schemas/recentFilings";
import { normalizeFilingText } from "@/backend/utils/filingText";

function extractExhibitSection(text: string): string | null {
  const sectionStartPatterns = [
    /\(\s*d\s*\)\s*Exhibits?\.?/i,
    /Exhibit\s+No\.?\s+Description/i,
  ];

  let startIndex: number | null = null;

  for (const pattern of sectionStartPatterns) {
    const match = text.match(pattern);
    if (match && match.index !== undefined) {
      startIndex = match.index;
      break;
    }
  }

  if (startIndex === null) {
    return null;
  }

  return text.slice(startIndex).trim();
}

function isExhibitHeaderLine(line: string): boolean {
  return /Exhibit\s+No\.?\s+Description/i.test(line.trim());
}

function isLikelySectionLine(line: string): boolean {
  const trimmed = line.trim();

  if (!trimmed) return false;

  return (
    /^\(\s*[a-z]\s*\)/i.test(trimmed) ||
    /^Item\s+\d+\.\d+\.?/i.test(trimmed)
  );
}

function parseExhibitLine(
  line: string
): { exhibitNo: string; description: string } | null {
  const trimmed = line.trim();

  if (!trimmed || isExhibitHeaderLine(trimmed)) {
    return null;
  }

  // 예:
  // 99.1.    Press release dated April 15, 2026.
  // 104      Cover Page Interactive Data File ...
  // 10.1     Material Contract
  // 101.INS  XBRL Instance Document
  const match = trimmed.match(
    /^([0-9]{1,3}(?:\.[0-9A-Z]+)*)\.?\s+(.*)$/i
  );

  if (!match) {
    return null;
  }

  const exhibitNo = match[1]?.trim();
  const description = match[2]?.trim() ?? "";

  if (!exhibitNo || !description) {
    return null;
  }

  return {
    exhibitNo,
    description,
  };
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

  const lines = exhibitSection
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const results: FilingExhibitEntry[] = [];

  for (const line of lines) {
    if (isLikelySectionLine(line) && !/^\(\s*d\s*\)\s*Exhibits?\.?/i.test(line)) {
      break;
    }

    const parsed = parseExhibitLine(line);

    if (!parsed) {
      continue;
    }

    const description = parsed.description
      .replace(/\s+/g, " ")
      .replace(/\.\s*$/, "")
      .trim();

    if (!description || description.length < 3) {
      continue;
    }

    const key = `${parsed.exhibitNo}::${description}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    results.push({
      exhibitNo: parsed.exhibitNo,
      description,
    });
  }

  return results;
}
