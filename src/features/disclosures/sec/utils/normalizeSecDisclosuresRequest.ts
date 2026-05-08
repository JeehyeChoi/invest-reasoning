// features/disclosures/sec/utils/normalizeSecDisclosuresRequest.ts

import type { FilingForm } from "@/shared/disclosures/sec/constants";
import { DEFAULT_FILING_FORMS } from "@/shared/disclosures/sec/constants";
import { normalizeTickerInput } from "@/shared/tickers/utils";

export function normalizeSecDisclosuresRequest(input: unknown) {
  const body = (input ?? {}) as {
    tickers?: unknown;
    days?: unknown;
    forms?: unknown;
  };

  const tickers = normalizeTickerInput(body.tickers);
  const days = normalizeDays(body.days);
  const forms = normalizeForms(body.forms);

  return { tickers, days, forms };
}

function normalizeDays(input: unknown): number {
  if (typeof input !== "number" || !Number.isFinite(input) || input <= 0) {
    return 7;
  }
  return Math.floor(input);
}

function normalizeForms(input: unknown): FilingForm[] {
  if (!Array.isArray(input)) {
    return [...DEFAULT_FILING_FORMS];
  }

  const forms = input.filter(
    (v): v is FilingForm =>
      typeof v === "string" &&
      DEFAULT_FILING_FORMS.includes(v as FilingForm)
  );

  return forms.length > 0 ? forms : [...DEFAULT_FILING_FORMS];
}
