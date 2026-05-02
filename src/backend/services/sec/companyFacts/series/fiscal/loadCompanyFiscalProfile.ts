import { db } from "@/backend/config/db";
import type {
  CompanyFiscalProfile,
  FiscalAnnualPeriod,
  FiscalQuarterDurationProfile,
  FiscalQuarterProfileRow,
  FiscalRegime,
} from "@/backend/services/sec/companyFacts/series/fiscal/types";

type CompanyFiscalProfileRow = {
  cik: string;
  ticker: string | null;
  earliest_fiscal_year: number | null;
  latest_fiscal_year: number | null;
  latest_annual_start: Date | string | null;
  latest_annual_end: Date | string | null;
  fiscal_year_end_month: number | null;
  fiscal_year_end_day: number | null;
  fiscal_year_end_weekday: number | null;
  current_fiscal_regime_type: CompanyFiscalProfile["currentFiscalRegimeType"] | null;
  current_fiscal_regime_start_fiscal_year: number | null;
  current_fiscal_regime_end_fiscal_year: number | null;
  is_week_based_fiscal_year: boolean | null;
  has_53_week_fiscal_year: boolean | null;
  fiscal_year_end_history: unknown | null;
  annual_duration_days: number | null;
  quarter_duration_profile: unknown | null;
  source_accn: string | null;
  source_filed: Date | string | null;
  updated_at: Date | string;
};

type AnnualPeriodRow = {
  fiscal_year: number;
  start: Date | string;
  end: Date | string;
  duration_days: number | null;
  source_kind: FiscalAnnualPeriod["sourceKind"];
  is_transition: boolean;
  is_anchor: boolean;
  source_accn: string | null;
  source_filed: Date | string | null;
};

type QuarterPeriodRow = {
  fiscal_year: number;
  fiscal_quarter: 1 | 2 | 3 | 4;
  start: Date | string;
  end: Date | string;
  duration_days: number;
  source_kind: FiscalQuarterProfileRow["source"];
  source_accn: string | null;
  source_filed: Date | string | null;
};

export async function loadCompanyFiscalProfile(
  cik: string,
): Promise<CompanyFiscalProfile | null> {
  const [profileResult, annualResult, quarterResult] = await Promise.all([
    db.query<CompanyFiscalProfileRow>(
      `
      SELECT *
      FROM public.sec_company_fiscal_profiles
      WHERE cik = $1
      LIMIT 1
      `,
      [cik],
    ),
    db.query<AnnualPeriodRow>(
      `
      SELECT fiscal_year, start, "end", duration_days, source_kind, is_transition, is_anchor, source_accn, source_filed
      FROM public.sec_company_fiscal_annual_periods
      WHERE cik = $1
      ORDER BY fiscal_year ASC, "end" ASC
      `,
      [cik],
    ),
    db.query<QuarterPeriodRow>(
      `
      SELECT fiscal_year, fiscal_quarter, start, "end", duration_days, source_kind, source_accn, source_filed
      FROM public.sec_company_fiscal_quarter_periods
      WHERE cik = $1
      ORDER BY fiscal_year ASC, fiscal_quarter ASC, "end" ASC
      `,
      [cik],
    ),
  ]);

  const row = profileResult.rows[0];
  if (!row) return null;

  return {
    cik: row.cik,
    ticker: row.ticker,
    earliestFiscalYear: row.earliest_fiscal_year,
    latestFiscalYear: row.latest_fiscal_year,
    latestAnnualStart: toDateKey(row.latest_annual_start),
    latestAnnualEnd: toDateKey(row.latest_annual_end),
    fiscalYearEndMonth: row.fiscal_year_end_month,
    fiscalYearEndDay: row.fiscal_year_end_day,
    currentFiscalRegimeType: row.current_fiscal_regime_type,
    currentFiscalRegimeStartFiscalYear: row.current_fiscal_regime_start_fiscal_year,
    currentFiscalRegimeEndFiscalYear: row.current_fiscal_regime_end_fiscal_year,
    isWeekBasedFiscalYear: row.is_week_based_fiscal_year ?? false,
    fiscalYearEndWeekday: row.fiscal_year_end_weekday,
    has53WeekFiscalYear: row.has_53_week_fiscal_year ?? false,
    fiscalYearEndHistory: parseFiscalYearEndHistory(row.fiscal_year_end_history),
    annualDurationDays: row.annual_duration_days,
    quarterDurationProfile: parseQuarterDurationProfile(row.quarter_duration_profile),
    annualPeriods: annualResult.rows.map((period) => ({
      fiscalYear: period.fiscal_year,
      start: toDateKey(period.start) ?? "",
      end: toDateKey(period.end) ?? "",
      durationDays: period.duration_days,
      sourceKind: period.source_kind,
      isTransition: period.is_transition,
      isAnchor: period.is_anchor,
      sourceAccn: period.source_accn,
      sourceFiled: toDateKey(period.source_filed),
    })),
    quarterPeriods: quarterResult.rows.map((period) => ({
      fiscalYear: period.fiscal_year,
      fiscalQuarter: period.fiscal_quarter,
      start: toDateKey(period.start) ?? "",
      end: toDateKey(period.end) ?? "",
      durationDays: Number(period.duration_days),
      source: period.source_kind,
      sourceAccn: period.source_accn,
      sourceFiled: toDateKey(period.source_filed),
    })),
    sourceAccn: row.source_accn,
    sourceFiled: toDateKey(row.source_filed),
    updatedAt:
      row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

function parseQuarterDurationProfile(value: unknown): FiscalQuarterDurationProfile | null {
  if (!value || typeof value !== "object") return null;
  return value as FiscalQuarterDurationProfile;
}

function parseFiscalYearEndHistory(value: unknown): FiscalRegime[] {
  if (!Array.isArray(value)) return [];
  return value as FiscalRegime[];
}

function toDateKey(value: Date | string | null): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}
