// src/backend/services/sec/companyFacts/series/period/classifyFp.ts

export type FpPeriodHint =
  | "annual"
  | "quarter"
  | "other"
  | "unknown";

export type NormalizedFp =
  | "FY"
  | "Q1"
  | "Q2"
  | "Q3"
  | "Q4"
  | null;

function normalizeFp(fp: string | null | undefined): string | null {
  if (!fp) return null;
  return fp.trim().toUpperCase();
}

export function normalizeFpValue(
  fp: string | null | undefined,
): NormalizedFp {
  const f = normalizeFp(fp);
  if (!f) return null;

  if (f === "FY") return "FY";

  if (f === "Q1") return "Q1";
  if (f === "Q2") return "Q2";
  if (f === "Q3") return "Q3";
  if (f === "Q4") return "Q4";

  return null;
}

export function classifyFpPeriodHint(
  fp: string | null | undefined,
): FpPeriodHint {
  const f = normalizeFpValue(fp);

  if (!f) return "unknown";

  if (f === "FY") {
    return "annual";
  }

  if (f === "Q1" || f === "Q2" || f === "Q3" || f === "Q4") {
    return "quarter";
  }

  return "other";
}

export function fpToQuarter(
  fp: string | null | undefined,
): 1 | 2 | 3 | 4 | null {
  const f = normalizeFpValue(fp);

  if (f === "Q1") return 1;
  if (f === "Q2") return 2;
  if (f === "Q3") return 3;
  if (f === "Q4") return 4;

  return null;
}
