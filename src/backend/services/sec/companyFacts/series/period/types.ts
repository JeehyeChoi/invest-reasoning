// src/backend/services/sec/companyFacts/series/period/types.ts

import type { CompanyFiscalProfile } from "@/backend/services/sec/companyFacts/series/fiscal/types";
import type { CompanyFactTagSeriesRow } from "@/backend/services/sec/companyFacts/series/tag/types";
import type { PeriodResolveContext } from "@/backend/services/sec/companyFacts/series/period/resolveContext";

export type PeriodKind =
  | "annual"
  | "quarter"
  | "ytd"
  | "instant"
  | "other";

export type FiscalQuarter = 1 | 2 | 3 | 4;

export type PeriodResolutionBasis =
  | "fiscal_profile"
  | "sec_fp"
  | "sec_frame"
  | "duration"
  | "annual_window"
  | "quarter_window"
  | "unresolved";

export type PeriodResolutionIssue =
  | "missing_start"
  | "missing_end"
  | "missing_duration"
  | "missing_fiscal_profile"
  | "ambiguous_fiscal_year"
  | "ambiguous_fiscal_quarter"
  | "calendar_frame_only"
  | "outside_expected_window"
  | "unsupported_fp"
  | "unresolved";

export type PeriodWindowMatchKind =
  | "exact"
  | "near"
  | "partial"
  | "outside"
  | "unknown";

export type PeriodSecLabelAlignment =
  | "aligned"
  | "misaligned"
  | "unknown";

export type PeriodInputRow = Pick<
  CompanyFactTagSeriesRow,
  | "start"
  | "end"
  | "duration_days"
  | "fy"
  | "fp"
  | "form"
  | "frame"
  | "filed"
  | "accn"
>;

export type ResolvedPeriod = {
  kind: PeriodKind;

  fiscalYear: number | null;
  fiscalQuarter: FiscalQuarter | null;

  calendarYear: number | null;
  calendarQuarter: FiscalQuarter | null;

  expectedStart: string | null;
  expectedEnd: string | null;

  confidence: number;
  fitScore: number;
  windowMatchKind: PeriodWindowMatchKind;
  secLabelAlignment: PeriodSecLabelAlignment;
  basis: PeriodResolutionBasis;
  issues: PeriodResolutionIssue[];
};

export type ResolvePeriodInput = {
  row: PeriodInputRow;
  fiscalProfile: CompanyFiscalProfile | null;
  periodContext?: PeriodResolveContext;
};
