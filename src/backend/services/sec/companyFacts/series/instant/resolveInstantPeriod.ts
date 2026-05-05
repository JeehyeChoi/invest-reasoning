import { fpToQuarter } from "@/backend/services/sec/companyFacts/series/period/classifyFp";
import type { ResolvedPeriod } from "@/backend/services/sec/companyFacts/series/period/types";
import type { InstantSourceRow } from "@/backend/services/sec/companyFacts/series/instant/types";
import { requireDateKey } from "@/backend/services/sec/companyFacts/series/utils/dateKey";

export function resolveInstantPeriod(row: InstantSourceRow): ResolvedPeriod {
  return {
    kind: "instant",
    fiscalYear: row.fy ?? null,
    fiscalQuarter: fpToQuarter(row.fp),
    calendarYear: null,
    calendarQuarter: null,
    expectedStart: null,
    expectedEnd: requireDateKey(row.end),
    confidence: 0.85,
    fitScore: 0.85,
    windowMatchKind: "exact",
    secLabelAlignment: "unknown",
    basis: "instant_snapshot",
    issues: [],
  };
}
