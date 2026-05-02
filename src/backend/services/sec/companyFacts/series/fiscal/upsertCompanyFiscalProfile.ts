import { db } from "@/backend/config/db";
import type {
  CompanyFiscalProfile,
  FiscalAnnualPeriod,
  FiscalQuarterDurationRange,
  FiscalQuarterProfileRow,
  FiscalRegime,
} from "@/backend/services/sec/companyFacts/series/fiscal/types";

export async function upsertCompanyFiscalProfile(
  profile: CompanyFiscalProfile,
): Promise<void> {
  await upsertFiscalAnnualPeriods(profile.cik, profile.annualPeriods);
  await upsertFiscalQuarterPeriods(profile.cik, profile.quarterPeriods);

  await db.query(
    `
    INSERT INTO public.sec_company_fiscal_profiles (
      cik,
      ticker,
      earliest_fiscal_year,
      latest_fiscal_year,
      latest_annual_start,
      latest_annual_end,
      fiscal_year_end_month,
      fiscal_year_end_day,
      fiscal_year_end_weekday,
      current_fiscal_regime_type,
      current_fiscal_regime_start_fiscal_year,
      current_fiscal_regime_end_fiscal_year,
      is_week_based_fiscal_year,
      has_53_week_fiscal_year,
      fiscal_year_end_history,
      annual_duration_days,
      q1_duration_min,
      q1_duration_max,
      q1_duration_mode,
      q1_sample_count,
      q2_duration_min,
      q2_duration_max,
      q2_duration_mode,
      q2_sample_count,
      q3_duration_min,
      q3_duration_max,
      q3_duration_mode,
      q3_sample_count,
      q4_duration_min,
      q4_duration_max,
      q4_duration_mode,
      q4_sample_count,
      quarter_duration_profile,
      source_accn,
      source_filed,
      updated_at
    )
    VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9, $10, $11, $12, $13, $14,
      $15::jsonb, $16, $17, $18,
      $19, $20, $21, $22,
      $23, $24, $25, $26,
      $27, $28, $29, $30,
      $31, $32, $33::jsonb, $34, $35, now()
    )
    ON CONFLICT (cik) DO UPDATE SET
      ticker = EXCLUDED.ticker,
      earliest_fiscal_year = EXCLUDED.earliest_fiscal_year,
      latest_fiscal_year = EXCLUDED.latest_fiscal_year,
      latest_annual_start = EXCLUDED.latest_annual_start,
      latest_annual_end = EXCLUDED.latest_annual_end,
      fiscal_year_end_month = EXCLUDED.fiscal_year_end_month,
      fiscal_year_end_day = EXCLUDED.fiscal_year_end_day,
      fiscal_year_end_weekday = EXCLUDED.fiscal_year_end_weekday,
      current_fiscal_regime_type = EXCLUDED.current_fiscal_regime_type,
      current_fiscal_regime_start_fiscal_year = EXCLUDED.current_fiscal_regime_start_fiscal_year,
      current_fiscal_regime_end_fiscal_year = EXCLUDED.current_fiscal_regime_end_fiscal_year,
      is_week_based_fiscal_year = EXCLUDED.is_week_based_fiscal_year,
      has_53_week_fiscal_year = EXCLUDED.has_53_week_fiscal_year,
      fiscal_year_end_history = EXCLUDED.fiscal_year_end_history,
      annual_duration_days = EXCLUDED.annual_duration_days,
      q1_duration_min = EXCLUDED.q1_duration_min,
      q1_duration_max = EXCLUDED.q1_duration_max,
      q1_duration_mode = EXCLUDED.q1_duration_mode,
      q1_sample_count = EXCLUDED.q1_sample_count,
      q2_duration_min = EXCLUDED.q2_duration_min,
      q2_duration_max = EXCLUDED.q2_duration_max,
      q2_duration_mode = EXCLUDED.q2_duration_mode,
      q2_sample_count = EXCLUDED.q2_sample_count,
      q3_duration_min = EXCLUDED.q3_duration_min,
      q3_duration_max = EXCLUDED.q3_duration_max,
      q3_duration_mode = EXCLUDED.q3_duration_mode,
      q3_sample_count = EXCLUDED.q3_sample_count,
      q4_duration_min = EXCLUDED.q4_duration_min,
      q4_duration_max = EXCLUDED.q4_duration_max,
      q4_duration_mode = EXCLUDED.q4_duration_mode,
      q4_sample_count = EXCLUDED.q4_sample_count,
      quarter_duration_profile = EXCLUDED.quarter_duration_profile,
      source_accn = EXCLUDED.source_accn,
      source_filed = EXCLUDED.source_filed,
      updated_at = now()
    `,
    [
      profile.cik,
      profile.ticker,
      profile.earliestFiscalYear,
      profile.latestFiscalYear,
      profile.latestAnnualStart,
      profile.latestAnnualEnd,
      profile.fiscalYearEndMonth,
      profile.fiscalYearEndDay,
      profile.fiscalYearEndWeekday,
      profile.currentFiscalRegimeType,
      profile.currentFiscalRegimeStartFiscalYear,
      profile.currentFiscalRegimeEndFiscalYear,
      profile.isWeekBasedFiscalYear,
      profile.has53WeekFiscalYear,
      JSON.stringify(stripAnnualPeriodsFromRegimes(profile.fiscalYearEndHistory)),
      profile.annualDurationDays,
      profile.quarterDurationProfile?.q1?.min ?? null,
      profile.quarterDurationProfile?.q1?.max ?? null,
      profile.quarterDurationProfile?.q1?.mode ?? null,
      profile.quarterDurationProfile?.q1?.count ?? null,
      profile.quarterDurationProfile?.q2?.min ?? null,
      profile.quarterDurationProfile?.q2?.max ?? null,
      profile.quarterDurationProfile?.q2?.mode ?? null,
      profile.quarterDurationProfile?.q2?.count ?? null,
      profile.quarterDurationProfile?.q3?.min ?? null,
      profile.quarterDurationProfile?.q3?.max ?? null,
      profile.quarterDurationProfile?.q3?.mode ?? null,
      profile.quarterDurationProfile?.q3?.count ?? null,
      profile.quarterDurationProfile?.q4?.min ?? null,
      profile.quarterDurationProfile?.q4?.max ?? null,
      profile.quarterDurationProfile?.q4?.mode ?? null,
      profile.quarterDurationProfile?.q4?.count ?? null,
      profile.quarterDurationProfile
        ? JSON.stringify(stripQuarterPeriodsFromProfile(profile.quarterDurationProfile))
        : null,
      profile.sourceAccn,
      profile.sourceFiled,
    ],
  );
}

async function upsertFiscalAnnualPeriods(
  cik: string,
  periods: FiscalAnnualPeriod[],
): Promise<void> {
  await db.query(
    `DELETE FROM public.sec_company_fiscal_annual_periods WHERE cik = $1`,
    [cik],
  );

  if (periods.length === 0) return;

  const values: unknown[] = [];
  const placeholders = periods.map((period, index) => {
    const offset = index * 10;
    values.push(
      cik,
      period.fiscalYear,
      period.start,
      period.end,
      period.durationDays,
      period.sourceKind,
      period.isTransition,
      period.isAnchor,
      period.sourceAccn,
      period.sourceFiled,
    );

    return `(
      $${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5},
      $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}
    )`;
  });

  await db.query(
    `
    INSERT INTO public.sec_company_fiscal_annual_periods (
      cik, fiscal_year, start, "end", duration_days,
      source_kind, is_transition, is_anchor, source_accn, source_filed
    )
    VALUES ${placeholders.join(",")}
    `,
    values,
  );
}

async function upsertFiscalQuarterPeriods(
  cik: string,
  periods: FiscalQuarterProfileRow[],
): Promise<void> {
  await db.query(
    `DELETE FROM public.sec_company_fiscal_quarter_periods WHERE cik = $1`,
    [cik],
  );

  if (periods.length === 0) return;

  const values: unknown[] = [];
  const placeholders = periods.map((period, index) => {
    const offset = index * 9;
    values.push(
      cik,
      period.fiscalYear,
      period.fiscalQuarter,
      period.start,
      period.end,
      period.durationDays,
      period.source,
      period.sourceAccn,
      period.sourceFiled,
    );

    return `(
      $${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5},
      $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}
    )`;
  });

  await db.query(
    `
    INSERT INTO public.sec_company_fiscal_quarter_periods (
      cik, fiscal_year, fiscal_quarter, start, "end",
      duration_days, source_kind, source_accn, source_filed
    )
    VALUES ${placeholders.join(",")}
    `,
    values,
  );
}

function stripAnnualPeriodsFromRegimes(regimes: FiscalRegime[]) {
  return regimes.map((regime) => ({
    startFiscalYear: regime.startFiscalYear,
    endFiscalYear: regime.endFiscalYear,
    fiscalYearEndMonth: regime.fiscalYearEndMonth,
    fiscalYearEndDay: regime.fiscalYearEndDay,
    regimeType: regime.regimeType,
    endWeekday: regime.endWeekday,
    weekPattern: regime.weekPattern,
    confidence: regime.confidence,
    annualDurationDays: regime.annualDurationDays,
    notes: regime.notes,
  }));
}

function stripQuarterPeriodsFromProfile(
  profile: CompanyFiscalProfile["quarterDurationProfile"],
) {
  if (!profile) return null;

  return {
    q1: summarizeQuarterRange(profile.q1),
    q2: summarizeQuarterRange(profile.q2),
    q3: summarizeQuarterRange(profile.q3),
    q4: summarizeQuarterRange(profile.q4),
    outliers: profile.outliers,
  };
}

function summarizeQuarterRange(range: FiscalQuarterDurationRange | null) {
  if (!range) return null;
  return {
    min: range.min,
    max: range.max,
    mode: range.mode,
    count: range.count,
    startMonthDayMode: range.startMonthDayMode,
    endMonthDayMode: range.endMonthDayMode,
  };
}
