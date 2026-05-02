// src/backend/services/sec/companyFacts/series/period/classifyForm.ts

export type FormPeriodHint =
  | "annual"
  | "quarter"
  | "current"
  | "other"
  | "unknown";

function normalizeForm(form: string | null | undefined): string | null {
  if (!form) return null;
  return form.trim().toUpperCase();
}

export function classifyFormPeriodHint(
  form: string | null | undefined,
): FormPeriodHint {
  const f = normalizeForm(form);

  if (!f) return "unknown";

  // Annual reports
  if (f === "10-K" || f === "10-K/A") {
    return "annual";
  }

  // Quarterly reports
  if (f === "10-Q" || f === "10-Q/A") {
    return "quarter";
  }

  // Current reports (event-driven, not period-based)
  if (f === "8-K" || f === "8-K/A") {
    return "current";
  }

  // Foreign issuers (optional but useful)
  if (f === "20-F" || f === "20-F/A") {
    return "annual";
  }

  if (f === "40-F" || f === "40-F/A") {
    return "annual";
  }

  if (f === "6-K" || f === "6-K/A") {
    return "current";
  }

  return "other";
}
