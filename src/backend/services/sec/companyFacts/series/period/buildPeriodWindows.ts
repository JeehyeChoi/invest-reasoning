// src/backend/services/sec/companyFacts/series/period/buildPeriodWindows.ts

import type { CompanyFiscalProfile, FiscalAnnualPeriod, FiscalRegime } from "@/backend/services/sec/companyFacts/series/fiscal/types";
import type { FiscalQuarter } from "@/backend/services/sec/companyFacts/series/period/types";
import {
  toDateKey,
  toUtcDateMs,
} from "@/backend/services/sec/companyFacts/series/utils/dateKey";

export type FiscalYearWindow = {
  fiscalYear: number;
  start: string;
  end: string;
  fiscalYearEndMonth: number;
  fiscalYearEndDay: number;
  annualDurationDays: number | null;
  regimeConfidence: number;
  basis: "history_regime" | "latest_anchor";
};

export type FiscalQuarterWindow = {
  fiscalYear: number;
  fiscalQuarter: FiscalQuarter;
  start: string;
  end: string;
  durationDays: number | null;
  basis: "quarter_duration_profile";
};

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(dateKey: string, days: number): string {
  const ms = toUtcDateMs(dateKey);
  if (ms === null) throw new Error(`Invalid dateKey: ${dateKey}`);
  return toDateKey(new Date(ms + days * DAY_MS));
}

function daysBetweenInclusive(start: string, end: string): number | null {
  const s = toUtcDateMs(start);
  const e = toUtcDateMs(end);
  if (s === null || e === null) return null;
  return Math.round((e - s) / DAY_MS) + 1;
}

function buildDateFromMonthDay(
  year: number,
  month: number,
  day: number,
): string {
  return toDateKey(new Date(Date.UTC(year, month - 1, day)));
}

function inferFiscalYearEndCalendarYear(input: {
  fiscalYear: number;
  fiscalYearEndMonth: number;
  fiscalYearEndDay: number;
}): number {
  if (input.fiscalYearEndMonth === 1 && input.fiscalYearEndDay <= 7) {
    return input.fiscalYear + 1;
  }

  return input.fiscalYear;
}

function findRegimeForFiscalYear(
  regimes: FiscalRegime[],
  fiscalYear: number,
): FiscalRegime | null {
  return (
    regimes.find((regime) => {
      const startOk = fiscalYear >= regime.startFiscalYear;
      const endOk =
        regime.endFiscalYear === null || fiscalYear <= regime.endFiscalYear;
      return startOk && endOk;
    }) ?? null
  );
}

function getFiscalYearRange(profile: CompanyFiscalProfile): {
  startFiscalYear: number;
  endFiscalYear: number;
} | null {
  if (profile.earliestFiscalYear && profile.latestFiscalYear) {
    return {
      startFiscalYear: profile.earliestFiscalYear,
      endFiscalYear: profile.latestFiscalYear,
    };
  }

  if (profile.latestFiscalYear) {
    return {
      startFiscalYear: profile.latestFiscalYear - 8,
      endFiscalYear: profile.latestFiscalYear,
    };
  }

  return null;
}

function getFallbackRegime(profile: CompanyFiscalProfile): FiscalRegime | null {
  if (!profile.fiscalYearEndMonth || !profile.fiscalYearEndDay) return null;

  return {
    startFiscalYear: profile.earliestFiscalYear ?? profile.latestFiscalYear ?? 0,
    endFiscalYear: null,
    fiscalYearEndMonth: profile.fiscalYearEndMonth,
    fiscalYearEndDay: profile.fiscalYearEndDay,
    regimeType: profile.currentFiscalRegimeType ?? "fiscal_month_end",
    endWeekday: profile.fiscalYearEndWeekday,
    weekPattern:
      profile.isWeekBasedFiscalYear && profile.fiscalYearEndMonth
        ? {
            endMonth: profile.fiscalYearEndMonth,
            endWeekday: profile.fiscalYearEndWeekday,
            has53WeekYear: profile.has53WeekFiscalYear,
            fullYearDurations:
              profile.annualDurationDays == null ? [] : [profile.annualDurationDays],
          }
        : null,
    confidence: 0.5,
    annualDurationDays: profile.annualDurationDays,
    notes: "Fallback regime synthesized from latest fiscal profile fields.",
  };
}

function resolveRegimeForFiscalYear(
  profile: CompanyFiscalProfile,
  fiscalYear: number,
): FiscalRegime | null {
  const fromHistory = findRegimeForFiscalYear(
    profile.fiscalYearEndHistory ?? [],
    fiscalYear,
  );

  return fromHistory ?? getFallbackRegime(profile);
}

function findExactAnnualPeriod(
  profile: CompanyFiscalProfile,
  fiscalYear: number,
): FiscalAnnualPeriod | null {
  return profile.annualPeriods.find((period) => period.fiscalYear === fiscalYear) ?? null;
}

export function buildFiscalYearWindows(
  profile: CompanyFiscalProfile,
): FiscalYearWindow[] {
  const range = getFiscalYearRange(profile);
  if (!range) return [];

  const windows: FiscalYearWindow[] = [];

  for (
    let fiscalYear = range.startFiscalYear;
    fiscalYear <= range.endFiscalYear;
    fiscalYear++
  ) {
    const regime = resolveRegimeForFiscalYear(profile, fiscalYear);
    if (!regime) continue;

    const exactAnnualPeriod = findExactAnnualPeriod(profile, fiscalYear);

    if (exactAnnualPeriod?.start && exactAnnualPeriod?.end) {
      windows.push({
        fiscalYear,
        start: exactAnnualPeriod.start,
        end: exactAnnualPeriod.end,
        fiscalYearEndMonth: regime.fiscalYearEndMonth,
        fiscalYearEndDay: regime.fiscalYearEndDay,
        annualDurationDays:
          exactAnnualPeriod.durationDays ??
          daysBetweenInclusive(exactAnnualPeriod.start, exactAnnualPeriod.end),
        regimeConfidence: regime.confidence,
        basis:
          profile.fiscalYearEndHistory && profile.fiscalYearEndHistory.length > 0
            ? "history_regime"
            : "latest_anchor",
      });
      continue;
    }

    const endCalendarYear = inferFiscalYearEndCalendarYear({
      fiscalYear,
      fiscalYearEndMonth: regime.fiscalYearEndMonth,
      fiscalYearEndDay: regime.fiscalYearEndDay,
    });

    const end = buildDateFromMonthDay(
      endCalendarYear,
      regime.fiscalYearEndMonth,
      regime.fiscalYearEndDay,
    );

    const duration = regime.annualDurationDays ?? profile.annualDurationDays;

    const start = duration
      ? addDays(end, -(duration - 1))
      : fiscalYear === profile.latestFiscalYear && profile.latestAnnualStart
        ? profile.latestAnnualStart
        : addDays(end, -364);

    windows.push({
      fiscalYear,
      start,
      end,
      fiscalYearEndMonth: regime.fiscalYearEndMonth,
      fiscalYearEndDay: regime.fiscalYearEndDay,
      annualDurationDays: daysBetweenInclusive(start, end),
      regimeConfidence: regime.confidence,
      basis:
        profile.fiscalYearEndHistory && profile.fiscalYearEndHistory.length > 0
          ? "history_regime"
          : "latest_anchor",
    });
  }

  return windows;
}

function getQuarterDurationMode(
  profile: CompanyFiscalProfile,
  quarter: FiscalQuarter,
): number | null {
  const q = profile.quarterDurationProfile?.[`q${quarter}`];
  return q?.mode ?? null;
}

function buildCompleteQuarterPeriodIndex(
  profile: CompanyFiscalProfile,
): Map<number, Map<FiscalQuarter, (typeof profile.quarterPeriods)[number]>> {
  const byFiscalYear = new Map<
    number,
    Map<FiscalQuarter, (typeof profile.quarterPeriods)[number]>
  >();

  for (const period of profile.quarterPeriods) {
    const quarterMap = byFiscalYear.get(period.fiscalYear) ?? new Map();
    quarterMap.set(period.fiscalQuarter, period);
    byFiscalYear.set(period.fiscalYear, quarterMap);
  }

  const completeOnly = new Map<
    number,
    Map<FiscalQuarter, (typeof profile.quarterPeriods)[number]>
  >();

  for (const [fiscalYear, quarterMap] of byFiscalYear.entries()) {
    if (
      quarterMap.has(1) &&
      quarterMap.has(2) &&
      quarterMap.has(3) &&
      quarterMap.has(4)
    ) {
      completeOnly.set(fiscalYear, quarterMap);
    }
  }

  return completeOnly;
}

export function buildFiscalQuarterWindows(
  profile: CompanyFiscalProfile,
): FiscalQuarterWindow[] {
  const yearWindows = buildFiscalYearWindows(profile);
  const completeQuarterPeriodIndex = buildCompleteQuarterPeriodIndex(profile);
  const results: FiscalQuarterWindow[] = [];

  for (const yearWindow of yearWindows) {
    const exactQuarterMap = completeQuarterPeriodIndex.get(yearWindow.fiscalYear);

    if (exactQuarterMap) {
      for (const fiscalQuarter of [1, 2, 3, 4] as const) {
        const exactPeriod = exactQuarterMap.get(fiscalQuarter);
        if (!exactPeriod) continue;

        results.push({
          fiscalYear: exactPeriod.fiscalYear,
          fiscalQuarter: exactPeriod.fiscalQuarter,
          start: exactPeriod.start,
          end: exactPeriod.end,
          durationDays: exactPeriod.durationDays,
          basis: "quarter_duration_profile",
        });
      }

      continue;
    }

    let cursor = yearWindow.start;

    for (const fiscalQuarter of [1, 2, 3, 4] as const) {
      const start = cursor;
      const duration =
        fiscalQuarter === 4
          ? daysBetweenInclusive(start, yearWindow.end) ??
            getQuarterDurationMode(profile, fiscalQuarter) ??
            Math.round((yearWindow.annualDurationDays ?? 364) / 4)
          : getQuarterDurationMode(profile, fiscalQuarter) ??
            Math.round((yearWindow.annualDurationDays ?? 364) / 4);
      const end =
        fiscalQuarter === 4 ? yearWindow.end : addDays(start, duration - 1);

      results.push({
        fiscalYear: yearWindow.fiscalYear,
        fiscalQuarter,
        start,
        end,
        durationDays: daysBetweenInclusive(start, end) ?? duration,
        basis: "quarter_duration_profile",
      });

      cursor = addDays(end, 1);
    }
  }

  return results;
}
