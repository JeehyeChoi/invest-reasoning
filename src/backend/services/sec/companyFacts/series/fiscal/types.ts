export type FiscalQuarterDurationRange = {
  min: number;
  max: number;
  mode: number;
  count: number;
  startMonthDayMode: FiscalYearEnd | null;
  endMonthDayMode: FiscalYearEnd | null;
};

export type FiscalQuarterSourceKind =
  | "direct"
  | "cumulative_derived"
  | "annual_derived";

export type FiscalQuarterProfileRow = {
  fiscalYear: number;
  fiscalQuarter: 1 | 2 | 3 | 4;
  start: string;
  end: string;
  durationDays: number;
  source: FiscalQuarterSourceKind;
  sourceAccn: string | null;
  sourceFiled: string | null;
};

export type FiscalQuarterDurationProfile = {
  q1: FiscalQuarterDurationRange | null;
  q2: FiscalQuarterDurationRange | null;
  q3: FiscalQuarterDurationRange | null;
  q4: FiscalQuarterDurationRange | null;
  outliers: Array<{
    fp: "Q1" | "Q2" | "Q3" | "Q4";
    min: number;
    max: number;
    count: number;
  }>;
};

export type FiscalYearEnd = {
  month: number;
  day: number;
};

export type FiscalAnnualSourceKind =
  | "annual_report"
  | "annual_report_transition"
  | "derived_from_quarters";

export type FiscalRegimeType =
  | "calendar_month_end"
  | "fiscal_month_end"
  | "week_52_53"
  | "transition";

export type FiscalWeekPattern = {
  endMonth: number | null;
  endWeekday: number | null;
  has53WeekYear: boolean;
  fullYearDurations: number[];
};

export type FiscalAnnualPeriod = {
  start: string;
  end: string;
  durationDays: number | null;
  fiscalYear: number | null;
  sourceKind: FiscalAnnualSourceKind;
  isTransition: boolean;
  isAnchor: boolean;
  sourceAccn: string | null;
  sourceFiled: string | null;
};

export type FiscalRegime = {
  startFiscalYear: number;
  endFiscalYear: number | null;
  fiscalYearEndMonth: number;
  fiscalYearEndDay: number;
  regimeType: FiscalRegimeType;
  endWeekday: number | null;
  weekPattern: FiscalWeekPattern | null;
  confidence: number;
  annualDurationDays: number | null;
  notes: string | null;
};

export type CompanyFiscalProfile = {
  cik: string;
  ticker: string | null;

  earliestFiscalYear: number | null;
  latestFiscalYear: number | null;
  latestAnnualStart: string | null;
  latestAnnualEnd: string | null;

  // latest/default shortcut
  fiscalYearEndMonth: number | null;
  fiscalYearEndDay: number | null;
  currentFiscalRegimeType: FiscalRegimeType | null;
  currentFiscalRegimeStartFiscalYear: number | null;
  currentFiscalRegimeEndFiscalYear: number | null;
  isWeekBasedFiscalYear: boolean;
  fiscalYearEndWeekday: number | null;
  has53WeekFiscalYear: boolean;

  // historical regimes
  fiscalYearEndHistory: FiscalRegime[];

  annualDurationDays: number | null;
  quarterDurationProfile: FiscalQuarterDurationProfile | null;
  annualPeriods: FiscalAnnualPeriod[];
  quarterPeriods: FiscalQuarterProfileRow[];

  sourceAccn: string | null;
  sourceFiled: string | null;

  updatedAt: string;
};

export type CompanyMetricSignProfileKind =
  | "positive_dominant"
  | "negative_dominant"
  | "mixed"
  | "zero_or_sparse"
  | "unknown";

export type CompanyMetricExpectedSign =
  | "positive"
  | "negative"
  | "mixed"
  | "unknown";

export type CompanyMetricSignProfileSourceScope =
  | "raw_direct"
  | "raw_direct_10k_10q"
  | "raw_direct_and_restated";

export type CompanyMetricSignProfile = {
  cik: string;
  ticker: string | null;
  metricKey: string;
  tag: string;
  unit: string;
  signProfile: CompanyMetricSignProfileKind;
  expectedSign: CompanyMetricExpectedSign;
  sampleCount: number;
  positiveCount: number;
  negativeCount: number;
  zeroCount: number;
  positiveRatio: number | null;
  negativeRatio: number | null;
  firstEnd: string | null;
  latestEnd: string | null;
  confidence: number;
  sourceScope: CompanyMetricSignProfileSourceScope;
  notes: Record<string, unknown> | null;
};
