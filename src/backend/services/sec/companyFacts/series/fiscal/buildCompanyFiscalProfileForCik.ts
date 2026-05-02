import { db } from "@/backend/config/db";
import { deriveCompanyMetricSignProfilesForCik } from "@/backend/services/sec/companyFacts/series/fiscal/deriveCompanyMetricSignProfilesForCik";
import { upsertCompanyFiscalProfile } from "@/backend/services/sec/companyFacts/series/fiscal/upsertCompanyFiscalProfile";
import { upsertCompanyMetricSignProfiles } from "@/backend/services/sec/companyFacts/series/fiscal/upsertCompanyMetricSignProfiles";
import type {
  CompanyFiscalProfile,
  FiscalAnnualPeriod,
  FiscalQuarterDurationProfile,
  FiscalQuarterDurationRange,
  FiscalQuarterProfileRow,
  FiscalRegimeType,
  FiscalQuarterSourceKind,
  FiscalRegime,
  FiscalWeekPattern,
  FiscalYearEnd,
} from "@/backend/services/sec/companyFacts/series/fiscal/types";

type AnnualRawRow = {
  cik: string;
  fy: number | null;
  fp: string | null;
  form: string | null;
  frame: string | null;
  start: Date | string;
  end: Date | string;
  duration_days: number;
  raw_count: number;
  accn: string | null;
  filed: Date | string | null;
};

type AnnualCandidateRow = AnnualRawRow & {
  startKey: string;
  endKey: string;
  fiscalYear: number;
  rawFiscalYear: number;
  fiscalYearEnd: FiscalYearEnd;
  sourceKind: FiscalAnnualPeriod["sourceKind"];
  isTransition: boolean;
};

type QuarterRawRow = {
  fy: number | null;
  fp: "Q1" | "Q2" | "Q3" | "Q4";
  start: Date | string;
  end: Date | string;
  duration_days: number;
  filed: Date | string | null;
  accn: string | null;
  n: number;
};

type QuarterCandidateRow = QuarterRawRow & {
  startKey: string;
  endKey: string;
  fiscalYear: number;
};

type AnnualSelection = {
  anchor: FiscalAnnualPeriod;
  earliestFiscalYear: number | null;
  latestFiscalYear: number | null;
  annualPeriods: FiscalAnnualPeriod[];
  regimes: FiscalRegime[];
};

type QuarterBuildResult = {
  profile: FiscalQuarterDurationProfile | null;
  quarterPeriods: FiscalQuarterProfileRow[];
};

const FULL_YEAR_MIN_DAYS = 330;
const FULL_YEAR_MAX_DAYS = 400;
const TRANSITION_MIN_DAYS = 30;

const DIRECT_QUARTER_MIN_DAYS = 60;
const DIRECT_QUARTER_MAX_DAYS = 140;
const CUMULATIVE_MIN_DAYS = 120;
const CUMULATIVE_MAX_DAYS = 320;

const QUARTER_TOLERANCE_DAYS = 7;

export async function buildCompanyFiscalProfileForCik(input: {
  ticker: string;
  cik: string;
}): Promise<CompanyFiscalProfile | null> {
  const annualCandidates = await loadAnnualCandidates(input.cik);
  const annualSelection = buildAnnualSelection(annualCandidates);

  if (!annualSelection) {
    return null;
  }

  const quarterRows = await loadQuarterCandidates(input.cik);
  const quarterBuildResult = buildQuarterDurationProfile({
    annualPeriods: annualSelection.annualPeriods,
    quarterRows,
  });

  const anchorEndParts = parseDateParts(annualSelection.anchor.end);

  const profile: CompanyFiscalProfile = {
    cik: input.cik,
    ticker: input.ticker,

    earliestFiscalYear: annualSelection.earliestFiscalYear,
    latestFiscalYear: annualSelection.latestFiscalYear,
    latestAnnualStart: annualSelection.anchor.start,
    latestAnnualEnd: annualSelection.anchor.end,

    fiscalYearEndMonth: anchorEndParts?.month ?? null,
    fiscalYearEndDay: anchorEndParts?.day ?? null,
    currentFiscalRegimeType: annualSelection.regimes.at(-1)?.regimeType ?? null,
    currentFiscalRegimeStartFiscalYear:
      annualSelection.regimes.at(-1)?.startFiscalYear ?? null,
    currentFiscalRegimeEndFiscalYear:
      annualSelection.regimes.at(-1)?.endFiscalYear ?? null,
    isWeekBasedFiscalYear: annualSelection.regimes.at(-1)?.regimeType === "week_52_53",
    fiscalYearEndWeekday: annualSelection.regimes.at(-1)?.endWeekday ?? null,
    has53WeekFiscalYear:
      annualSelection.regimes.some((regime) => regime.weekPattern?.has53WeekYear === true),

    fiscalYearEndHistory: annualSelection.regimes,

    annualDurationDays:
      annualSelection.anchor.isTransition
        ? findLatestFullYearDuration(annualSelection.annualPeriods)
        : annualSelection.anchor.durationDays,
    quarterDurationProfile: quarterBuildResult.profile,
    annualPeriods: annualSelection.annualPeriods,
    quarterPeriods: quarterBuildResult.quarterPeriods,

    sourceAccn: annualSelection.anchor.sourceAccn,
    sourceFiled: annualSelection.anchor.sourceFiled,

    updatedAt: new Date().toISOString(),
  };

  await upsertCompanyFiscalProfile(profile);
  const metricSignProfiles = await deriveCompanyMetricSignProfilesForCik({
    ticker: input.ticker,
    cik: input.cik,
    fiscalProfile: profile,
  });
  await upsertCompanyMetricSignProfiles({
    cik: input.cik,
    rows: metricSignProfiles,
  });

  return profile;
}

async function loadAnnualCandidates(cik: string): Promise<AnnualCandidateRow[]> {
  const result = await db.query<AnnualRawRow>(
    `
    SELECT DISTINCT ON (fy, start, "end", COALESCE(fp, ''), COALESCE(form, ''))
      cik,
      fy,
      fp,
      form,
      frame,
      start,
      "end",
      ("end"::date - start::date + 1)::int AS duration_days,
      COUNT(*) OVER (PARTITION BY start, "end")::int AS raw_count,
      accn,
      filed
    FROM public.sec_companyfact_raw
    WHERE cik = $1
      AND form IN ('10-K', '10-K/A', '20-F', '20-F/A', '40-F', '40-F/A')
      AND (frame IS NULL OR frame ~ '^CY[0-9]{4}$')
      AND start IS NOT NULL
      AND "end" IS NOT NULL
      AND fy IS NOT NULL
      AND ("end"::date - start::date + 1) >= ${TRANSITION_MIN_DAYS}
    ORDER BY
      fy,
      start,
      "end",
      COALESCE(fp, ''),
      COALESCE(form, ''),
      filed DESC NULLS LAST,
      accn DESC NULLS LAST
    `,
    [cik],
  );

  return result.rows
    .map((row) => {
      const startKey = toDateKey(row.start);
      const endKey = toDateKey(row.end);
      const fiscalYearEnd = parseDateParts(endKey);
      const sourceKind = classifyAnnualSourceKind(row);

      if (!startKey || !endKey || !fiscalYearEnd || row.fy == null || !sourceKind) {
        return null;
      }

      return {
        ...row,
        startKey,
        endKey,
        fiscalYear: inferAnnualFiscalYearFromPeriod(endKey),
        rawFiscalYear: row.fy,
        fiscalYearEnd,
        sourceKind,
        isTransition: sourceKind === "annual_report_transition",
      };
    })
    .filter((row): row is AnnualCandidateRow => row != null);
}

function classifyAnnualSourceKind(
  row: AnnualRawRow,
): FiscalAnnualPeriod["sourceKind"] | null {
  const normalizedFp = String(row.fp ?? "").trim().toUpperCase();
  const normalizedForm = String(row.form ?? "").trim().toUpperCase();

  if (!["10-K", "10-K/A", "20-F", "20-F/A", "40-F", "40-F/A"].includes(normalizedForm)) {
    return null;
  }

  if (normalizedFp !== "FY") {
    return null;
  }

  if (row.duration_days >= FULL_YEAR_MIN_DAYS && row.duration_days <= FULL_YEAR_MAX_DAYS) {
    return "annual_report";
  }

  if (row.duration_days >= TRANSITION_MIN_DAYS && row.duration_days < FULL_YEAR_MIN_DAYS) {
    return "annual_report_transition";
  }

  return null;
}

function buildAnnualSelection(
  annualRows: AnnualCandidateRow[],
): AnnualSelection | null {
  if (annualRows.length === 0) return null;

  const selectedByFiscalYear = selectAnnualRowsByFiscalYear(annualRows);
  if (selectedByFiscalYear.length === 0) return null;

  const annualPeriods = selectedByFiscalYear.map((row) =>
    toAnnualPeriod(row, false),
  );

  const anchorRow = selectAnnualAnchor(selectedByFiscalYear);
  if (!anchorRow) return null;

  const regimes = buildFiscalYearEndHistory(selectedByFiscalYear, anchorRow.fiscalYear);
  const earliestFiscalYear = Math.min(...selectedByFiscalYear.map((row) => row.fiscalYear));
  const latestFiscalYear = Math.max(...selectedByFiscalYear.map((row) => row.fiscalYear));

  return {
    anchor: toAnnualPeriod(anchorRow, true),
    earliestFiscalYear,
    latestFiscalYear,
    annualPeriods,
    regimes,
  };
}

function selectAnnualRowsByFiscalYear(
  rows: AnnualCandidateRow[],
): AnnualCandidateRow[] {
  const grouped = new Map<number, AnnualCandidateRow[]>();

  for (const row of rows) {
    const list = grouped.get(row.fiscalYear) ?? [];
    list.push(row);
    grouped.set(row.fiscalYear, list);
  }

  return Array.from(grouped.entries())
    .map(([, group]) => {
      return [...group].sort(compareAnnualRows)[0] ?? null;
    })
    .filter((row): row is AnnualCandidateRow => row != null)
    .sort((a, b) => a.fiscalYear - b.fiscalYear);
}

function compareAnnualRows(a: AnnualCandidateRow, b: AnnualCandidateRow): number {
  const sourceRank = annualSourceRank(b.sourceKind) - annualSourceRank(a.sourceKind);
  if (sourceRank !== 0) return sourceRank;

  const supportRank = b.raw_count - a.raw_count;
  if (supportRank !== 0) return supportRank;

  const frameRank = annualFrameRank(b.frame) - annualFrameRank(a.frame);
  if (frameRank !== 0) return frameRank;

  const filedRank = toDateMs(b.filed) - toDateMs(a.filed);
  if (filedRank !== 0) return filedRank;

  const durationRank = b.duration_days - a.duration_days;
  if (durationRank !== 0) return durationRank;

  return String(b.accn ?? "").localeCompare(String(a.accn ?? ""));
}

function annualFrameRank(frame: string | null | undefined): number {
  if (frame == null || String(frame).trim() === "") return 3;
  if (/^CY[0-9]{4}$/.test(String(frame).trim())) return 2;
  return 1;
}

function annualSourceRank(kind: FiscalAnnualPeriod["sourceKind"]): number {
  if (kind === "annual_report") return 3;
  if (kind === "annual_report_transition") return 2;
  return 1;
}

function selectAnnualAnchor(rows: AnnualCandidateRow[]): AnnualCandidateRow | null {
  const preferred = [...rows]
    .filter((row) => row.sourceKind === "annual_report")
    .sort((a, b) => {
      if (b.fiscalYear !== a.fiscalYear) return b.fiscalYear - a.fiscalYear;
      return compareAnnualRows(a, b);
    });

  if (preferred.length > 0) {
    return preferred[0];
  }

  return [...rows].sort((a, b) => {
    if (b.fiscalYear !== a.fiscalYear) return b.fiscalYear - a.fiscalYear;
    return compareAnnualRows(a, b);
  })[0] ?? null;
}

function toAnnualPeriod(
  row: AnnualCandidateRow,
  isAnchor: boolean,
): FiscalAnnualPeriod {
  return {
    fiscalYear: row.fiscalYear,
    start: row.startKey,
    end: row.endKey,
    durationDays: row.duration_days,
    sourceKind: row.sourceKind,
    isTransition: row.isTransition,
    isAnchor,
    sourceAccn: row.accn,
    sourceFiled: row.filed ? toDateKey(row.filed) : null,
  };
}

function buildFiscalYearEndHistory(
  rows: AnnualCandidateRow[],
  anchorFiscalYear: number,
): FiscalRegime[] {
  if (rows.length === 0) return [];

  const regimes: FiscalRegime[] = [];
  let currentRows: AnnualCandidateRow[] = [rows[0]];

  for (const row of rows.slice(1)) {
    const previous = currentRows[currentRows.length - 1];

    if (isSameFiscalYearEnd(row.fiscalYearEnd, previous.fiscalYearEnd)) {
      currentRows.push(row);
      continue;
    }

    regimes.push(buildRegime(currentRows, anchorFiscalYear));
    currentRows = [row];
  }

  regimes.push(buildRegime(currentRows, anchorFiscalYear));
  return regimes;
}

function buildRegime(
  rows: AnnualCandidateRow[],
  anchorFiscalYear: number,
): FiscalRegime {
  const latest = rows[rows.length - 1];
  const regimeType = classifyRegimeType(rows);
  const weekPattern = buildWeekPattern(rows, regimeType);
  const notes: string[] = [];
  const transitionYears = rows
    .filter((row) => row.isTransition)
    .map((row) => row.fiscalYear);

  if (transitionYears.length > 0) {
    notes.push(`Transition annual periods observed in FY ${transitionYears.join(", ")}.`);
  }

  if (latest.fiscalYear === anchorFiscalYear) {
    notes.push("Includes the latest annual anchor regime.");
  }

  return {
    startFiscalYear: rows[0].fiscalYear,
    endFiscalYear: latest.fiscalYear === anchorFiscalYear ? null : latest.fiscalYear,
    fiscalYearEndMonth: latest.fiscalYearEnd.month,
    fiscalYearEndDay: latest.fiscalYearEnd.day,
    regimeType,
    endWeekday: weekdayFromDateKey(latest.endKey),
    weekPattern,
    confidence: confidenceFromCount(rows.length),
    annualDurationDays: findModeNumber(rows.map((row) => row.duration_days)),
    notes: notes.length > 0 ? notes.join(" ") : null,
  };
}

function classifyRegimeType(rows: AnnualCandidateRow[]): FiscalRegimeType {
  if (rows.some((row) => row.isTransition)) {
    return "transition";
  }

  const fullYearRows = rows.filter(
    (row) => row.duration_days >= FULL_YEAR_MIN_DAYS && row.duration_days <= FULL_YEAR_MAX_DAYS,
  );

  const monthEndCount = fullYearRows.filter((row) => isMonthEnd(row.endKey)).length;
  if (fullYearRows.length > 0 && monthEndCount === fullYearRows.length) {
    const latest = fullYearRows[fullYearRows.length - 1];
    if (latest.fiscalYearEnd.month === 12 && latest.fiscalYearEnd.day === 31) {
      return "calendar_month_end";
    }

    return "fiscal_month_end";
  }

  if (looksLikeWeekBasedRegime(fullYearRows)) {
    return "week_52_53";
  }

  return "fiscal_month_end";
}

function buildWeekPattern(
  rows: AnnualCandidateRow[],
  regimeType: FiscalRegimeType,
): FiscalWeekPattern | null {
  if (regimeType !== "week_52_53") return null;

  const fullYearRows = rows.filter(
    (row) => row.duration_days >= FULL_YEAR_MIN_DAYS && row.duration_days <= FULL_YEAR_MAX_DAYS,
  );

  if (fullYearRows.length === 0) return null;

  return {
    endMonth: findModeNumber(fullYearRows.map((row) => row.fiscalYearEnd.month)),
    endWeekday: findModeNumber(
      fullYearRows
        .map((row) => weekdayFromDateKey(row.endKey))
        .filter((value): value is number => value != null),
    ),
    has53WeekYear: fullYearRows.some((row) => row.duration_days >= 370),
    fullYearDurations: Array.from(
      new Set(fullYearRows.map((row) => row.duration_days)),
    ).sort((a, b) => a - b),
  };
}

async function loadQuarterCandidates(cik: string): Promise<QuarterCandidateRow[]> {
  const result = await db.query<QuarterRawRow>(
    `
    SELECT DISTINCT ON (fy, fp, start, "end")
      fy,
      fp,
      start,
      "end",
      ("end"::date - start::date + 1)::int AS duration_days,
      filed,
      accn,
      COUNT(*) OVER (PARTITION BY fy, fp, start, "end")::int AS n
    FROM public.sec_companyfact_raw
    WHERE cik = $1
      AND fp IN ('Q1', 'Q2', 'Q3', 'Q4')
      AND start IS NOT NULL
      AND "end" IS NOT NULL
      AND fy IS NOT NULL
    ORDER BY
      fy,
      fp,
      start,
      "end",
      filed DESC NULLS LAST,
      accn DESC NULLS LAST
    `,
    [cik],
  );

  return result.rows
    .map((row) => {
      const startKey = toDateKey(row.start);
      const endKey = toDateKey(row.end);

      if (!startKey || !endKey || row.fy == null) return null;

      return {
        ...row,
        startKey,
        endKey,
        fiscalYear: row.fy,
      };
    })
    .filter((row): row is QuarterCandidateRow => row != null);
}

function buildQuarterDurationProfile(input: {
  annualPeriods: FiscalAnnualPeriod[];
  quarterRows: QuarterCandidateRow[];
}): QuarterBuildResult {
  const annualPeriods = input.annualPeriods
    .filter((period) => period.fiscalYear != null)
    .sort((a, b) => (a.fiscalYear ?? 0) - (b.fiscalYear ?? 0));

  if (annualPeriods.length === 0) {
    return { profile: null, quarterPeriods: [] };
  }

  const resolvedRows = annualPeriods.flatMap((annualPeriod) =>
    resolveFiscalQuarterRowsForAnnualPeriod({
      annualPeriod,
      quarterRows: input.quarterRows,
    }),
  );

  if (resolvedRows.length === 0) {
    return { profile: null, quarterPeriods: [] };
  }

  const outlierCandidates = input.quarterRows.filter((row) => {
    if (isDirectQuarterCandidate(row.duration_days)) return false;
    if (isCumulativeQuarterCandidate(row.duration_days)) return false;

    return row.duration_days >= 45 && row.duration_days <= 180;
  });

  return {
    profile: {
      q1: buildQuarterRange(resolvedRows.filter((row) => row.fiscalQuarter === 1)),
      q2: buildQuarterRange(resolvedRows.filter((row) => row.fiscalQuarter === 2)),
      q3: buildQuarterRange(resolvedRows.filter((row) => row.fiscalQuarter === 3)),
      q4: buildQuarterRange(resolvedRows.filter((row) => row.fiscalQuarter === 4)),
      outliers: buildOutlierSummary(outlierCandidates),
    },
    quarterPeriods: resolvedRows,
  };
}

function resolveFiscalQuarterRowsForAnnualPeriod(input: {
  annualPeriod: FiscalAnnualPeriod;
  quarterRows: QuarterCandidateRow[];
}): FiscalQuarterProfileRow[] {
  const annualStartMs = toUtcDateMs(input.annualPeriod.start);
  const annualEndMs = toUtcDateMs(input.annualPeriod.end);

  if (annualStartMs == null || annualEndMs == null || input.annualPeriod.fiscalYear == null) {
    return [];
  }

  const rows = input.quarterRows.filter((row) => {
    const startMs = toUtcDateMs(row.startKey);
    const endMs = toUtcDateMs(row.endKey);

    if (startMs == null || endMs == null) return false;

    return (
      startMs >= annualStartMs - QUARTER_TOLERANCE_DAYS * DAY_MS &&
      endMs <= annualEndMs + QUARTER_TOLERANCE_DAYS * DAY_MS
    );
  });

  const q1 = resolveQuarterForAnnualPeriod({
    annualPeriod: input.annualPeriod,
    quarterRows: rows,
    quarter: 1,
    previousQuarter: null,
  });

  const q2 = resolveQuarterForAnnualPeriod({
    annualPeriod: input.annualPeriod,
    quarterRows: rows,
    quarter: 2,
    previousQuarter: q1,
  });

  const q3 = resolveQuarterForAnnualPeriod({
    annualPeriod: input.annualPeriod,
    quarterRows: rows,
    quarter: 3,
    previousQuarter: q2,
  });

  const q4 = resolveQuarterForAnnualPeriod({
    annualPeriod: input.annualPeriod,
    quarterRows: rows,
    quarter: 4,
    previousQuarter: q3,
  });

  return [q1, q2, q3, q4].filter((row): row is FiscalQuarterProfileRow => row != null);
}

function resolveQuarterForAnnualPeriod(input: {
  annualPeriod: FiscalAnnualPeriod;
  quarterRows: QuarterCandidateRow[];
  quarter: 1 | 2 | 3 | 4;
  previousQuarter: FiscalQuarterProfileRow | null;
}): FiscalQuarterProfileRow | null {
  const fp = `Q${input.quarter}` as QuarterCandidateRow["fp"];
  const annualStart = input.annualPeriod.start;
  const annualEnd = input.annualPeriod.end;
  const annualEndMs = toUtcDateMs(annualEnd);

  const candidates = input.quarterRows.filter((row) => row.fp === fp);
  const direct = selectDirectQuarterCandidate({
    quarter: input.quarter,
    candidates,
    annualStart,
    annualEnd,
    previousQuarter: input.previousQuarter,
  });

  if (direct) {
    return toQuarterProfileRow({
      fiscalYear: input.annualPeriod.fiscalYear!,
      fiscalQuarter: input.quarter,
      start: direct.startKey,
      end: direct.endKey,
      durationDays: direct.duration_days,
      source: "direct",
      sourceAccn: direct.accn,
      sourceFiled: direct.filed ? toDateKey(direct.filed) : null,
    });
  }

  const cumulative = selectCumulativeQuarterCandidate({
    quarter: input.quarter,
    candidates,
    annualStart,
    annualEnd,
  });

  if (cumulative && (input.quarter === 1 || input.previousQuarter)) {
    const start = input.quarter === 1 ? annualStart : nextDay(input.previousQuarter!.end);
    if (start) {
      return toDerivedQuarterFromBoundary({
        fiscalYear: input.annualPeriod.fiscalYear!,
        fiscalQuarter: input.quarter,
        start,
        end: cumulative.endKey,
        source: input.quarter === 1 ? "direct" : "cumulative_derived",
        sourceAccn: cumulative.accn,
        sourceFiled: cumulative.filed ? toDateKey(cumulative.filed) : null,
      });
    }
  }

  if (input.quarter === 4 && input.previousQuarter && annualEndMs != null) {
    const start = nextDay(input.previousQuarter.end);
    if (start) {
      return toDerivedQuarterFromBoundary({
        fiscalYear: input.annualPeriod.fiscalYear!,
        fiscalQuarter: 4,
        start,
        end: annualEnd,
        source: "annual_derived",
        sourceAccn: input.annualPeriod.sourceAccn,
        sourceFiled: input.annualPeriod.sourceFiled,
      });
    }
  }

  return null;
}

function selectDirectQuarterCandidate(input: {
  quarter: 1 | 2 | 3 | 4;
  candidates: QuarterCandidateRow[];
  annualStart: string;
  annualEnd: string;
  previousQuarter: FiscalQuarterProfileRow | null;
}): QuarterCandidateRow | null {
  const directCandidates = input.candidates.filter((row) => {
    if (!isDirectQuarterCandidate(row.duration_days)) return false;

    if (input.quarter === 1) {
      return areDatesClose(row.startKey, input.annualStart, QUARTER_TOLERANCE_DAYS);
    }

    if (input.previousQuarter) {
      const previousEndMs = toUtcDateMs(input.previousQuarter.end);
      const startMs = toUtcDateMs(row.startKey);

      if (
        previousEndMs == null ||
        startMs == null ||
        startMs <= previousEndMs
      ) {
        return false;
      }
    }

    if (input.quarter === 4) {
      return areDatesClose(row.endKey, input.annualEnd, QUARTER_TOLERANCE_DAYS);
    }

    return true;
  });

  return directCandidates.sort(compareQuarterRows)[0] ?? null;
}

function inferAnnualFiscalYearFromPeriod(endKey: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(endKey);
  if (!match) {
    return Number(endKey.slice(0, 4));
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month === 1 && day <= 7) {
    return year - 1;
  }

  return year;
}

function selectCumulativeQuarterCandidate(input: {
  quarter: 1 | 2 | 3 | 4;
  candidates: QuarterCandidateRow[];
  annualStart: string;
  annualEnd: string;
}): QuarterCandidateRow | null {
  if (input.quarter === 4) return null;

  const cumulativeCandidates = input.candidates.filter((row) => {
    if (!isCumulativeQuarterCandidate(row.duration_days)) return false;
    if (!areDatesClose(row.startKey, input.annualStart, QUARTER_TOLERANCE_DAYS)) {
      return false;
    }

    return !areDatesClose(row.endKey, input.annualEnd, QUARTER_TOLERANCE_DAYS);
  });

  return cumulativeCandidates.sort(compareQuarterRows)[0] ?? null;
}

function compareQuarterRows(a: QuarterCandidateRow, b: QuarterCandidateRow): number {
  const filedRank = toDateMs(b.filed) - toDateMs(a.filed);
  if (filedRank !== 0) return filedRank;

  const durationRank = Math.abs(91 - a.duration_days) - Math.abs(91 - b.duration_days);
  if (durationRank !== 0) return durationRank;

  return String(b.accn ?? "").localeCompare(String(a.accn ?? ""));
}

function toQuarterProfileRow(input: {
  fiscalYear: number;
  fiscalQuarter: 1 | 2 | 3 | 4;
  start: string;
  end: string;
  durationDays: number;
  source: FiscalQuarterSourceKind;
  sourceAccn: string | null;
  sourceFiled: string | null;
}): FiscalQuarterProfileRow {
  return {
    fiscalYear: input.fiscalYear,
    fiscalQuarter: input.fiscalQuarter,
    start: input.start,
    end: input.end,
    durationDays: input.durationDays,
    source: input.source,
    sourceAccn: input.sourceAccn,
    sourceFiled: input.sourceFiled,
  };
}

function toDerivedQuarterFromBoundary(input: {
  fiscalYear: number;
  fiscalQuarter: 1 | 2 | 3 | 4;
  start: string;
  end: string;
  source: FiscalQuarterSourceKind;
  sourceAccn: string | null;
  sourceFiled: string | null;
}): FiscalQuarterProfileRow | null {
  const durationDays = diffDaysInclusive(input.start, input.end);
  if (durationDays == null || durationDays <= 0) return null;

  return toQuarterProfileRow({
    ...input,
    durationDays,
  });
}

function buildQuarterRange(
  rows: FiscalQuarterProfileRow[],
): FiscalQuarterDurationRange | null {
  if (rows.length === 0) return null;

  const durations = rows.map((row) => row.durationDays);
  const startMonthDayMode = findModeMonthDay(rows.map((row) => row.start));
  const endMonthDayMode = findModeMonthDay(rows.map((row) => row.end));

  return {
    min: Math.min(...durations),
    max: Math.max(...durations),
    mode: findModeNumber(durations) ?? durations[0],
    count: rows.length,
    startMonthDayMode,
    endMonthDayMode,
  };
}

function buildOutlierSummary(rows: QuarterCandidateRow[]) {
  const map = new Map<
    string,
    { fp: QuarterCandidateRow["fp"]; min: number; max: number; count: number }
  >();

  for (const row of rows) {
    const current = map.get(row.fp);

    if (!current) {
      map.set(row.fp, {
        fp: row.fp,
        min: row.duration_days,
        max: row.duration_days,
        count: row.n,
      });
      continue;
    }

    current.min = Math.min(current.min, row.duration_days);
    current.max = Math.max(current.max, row.duration_days);
    current.count += row.n;
  }

  return Array.from(map.values());
}

function findLatestFullYearDuration(periods: FiscalAnnualPeriod[]): number | null {
  const durations = [...periods]
    .filter((period) => period.sourceKind === "annual_report" && period.durationDays != null)
    .sort((a, b) => (b.fiscalYear ?? 0) - (a.fiscalYear ?? 0));

  return durations[0]?.durationDays ?? null;
}

function looksLikeWeekBasedRegime(rows: AnnualCandidateRow[]): boolean {
  if (rows.length === 0) return false;

  const weekdays = rows
    .map((row) => weekdayFromDateKey(row.endKey))
    .filter((value): value is number => value != null);

  if (weekdays.length === 0) return false;

  const uniqueWeekdays = new Set(weekdays);
  const fullYearRows = rows.filter(
    (row) => row.duration_days >= FULL_YEAR_MIN_DAYS && row.duration_days <= FULL_YEAR_MAX_DAYS,
  );

  const hasWeekLikeDuration = fullYearRows.some((row) =>
    row.duration_days === 364 || row.duration_days === 365 || row.duration_days >= 370,
  );

  return uniqueWeekdays.size === 1 && hasWeekLikeDuration && rows.some((row) => !isMonthEnd(row.endKey));
}

function isMonthEnd(dateKey: string): boolean {
  const ms = toUtcDateMs(dateKey);
  if (ms == null) return false;

  const date = new Date(ms);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  return day === lastDay;
}

function weekdayFromDateKey(dateKey: string): number | null {
  const ms = toUtcDateMs(dateKey);
  if (ms == null) return null;
  return new Date(ms).getUTCDay();
}

function isDirectQuarterCandidate(durationDays: number): boolean {
  return durationDays >= DIRECT_QUARTER_MIN_DAYS && durationDays <= DIRECT_QUARTER_MAX_DAYS;
}

function isCumulativeQuarterCandidate(durationDays: number): boolean {
  return durationDays >= CUMULATIVE_MIN_DAYS && durationDays <= CUMULATIVE_MAX_DAYS;
}

function isSameFiscalYearEnd(a: FiscalYearEnd, b: FiscalYearEnd): boolean {
  return fiscalYearEndDistanceDays(a, b) <= QUARTER_TOLERANCE_DAYS;
}

function fiscalYearEndDistanceDays(a: FiscalYearEnd, b: FiscalYearEnd): number {
  const baseYear = 2000;
  const aMs = Date.UTC(baseYear, a.month - 1, a.day);
  const bMs = Date.UTC(baseYear, b.month - 1, b.day);
  const direct = Math.abs(aMs - bMs) / DAY_MS;

  return Math.min(
    direct,
    Math.abs(Date.UTC(baseYear + 1, a.month - 1, a.day) - bMs) / DAY_MS,
    Math.abs(aMs - Date.UTC(baseYear + 1, b.month - 1, b.day)) / DAY_MS,
  );
}

function areDatesClose(a: string, b: string, toleranceDays: number): boolean {
  const diff = absDiffDays(a, b);
  return diff !== null && diff <= toleranceDays;
}

function absDiffDays(a: string, b: string): number | null {
  const aMs = toUtcDateMs(a);
  const bMs = toUtcDateMs(b);

  if (aMs == null || bMs == null) return null;
  return Math.round(Math.abs(aMs - bMs) / DAY_MS);
}

function diffDaysInclusive(start: string, end: string): number | null {
  const startMs = toUtcDateMs(start);
  const endMs = toUtcDateMs(end);

  if (startMs == null || endMs == null || endMs < startMs) return null;
  return Math.round((endMs - startMs) / DAY_MS) + 1;
}

function nextDay(value: string): string | null {
  const ms = toUtcDateMs(value);
  if (ms == null) return null;
  return toDateKey(new Date(ms + DAY_MS));
}

function findModeNumber(values: number[]): number | null {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) return null;

  const counts = new Map<number, number>();
  for (const value of finite) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  let best = finite[0];
  let bestCount = counts.get(best) ?? 0;

  for (const [value, count] of counts.entries()) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }

  return best;
}

function findModeMonthDay(values: string[]): FiscalYearEnd | null {
  const counts = new Map<string, number>();

  for (const value of values) {
    const monthDay = value.slice(5, 10);
    if (!monthDay) continue;
    counts.set(monthDay, (counts.get(monthDay) ?? 0) + 1);
  }

  let best: string | null = null;
  let bestCount = 0;

  for (const [value, count] of counts.entries()) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }

  if (!best) return null;

  return {
    month: Number(best.slice(0, 2)),
    day: Number(best.slice(3, 5)),
  };
}

function confidenceFromCount(count: number): number {
  if (count >= 4) return 1;
  if (count === 3) return 0.9;
  if (count === 2) return 0.75;
  return 0.5;
}

function toDateKey(value: Date | string | null | undefined): string {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function toUtcDateMs(value: Date | string | null | undefined): number | null {
  const dateKey = toDateKey(value);
  if (!dateKey) return null;

  const ms = new Date(`${dateKey}T00:00:00.000Z`).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function toDateMs(value: Date | string | null): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();

  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function parseDateParts(dateKey: string): FiscalYearEnd | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;

  return {
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

const DAY_MS = 24 * 60 * 60 * 1000;
