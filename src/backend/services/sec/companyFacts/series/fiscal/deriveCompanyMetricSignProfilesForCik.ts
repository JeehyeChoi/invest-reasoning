import { getSecMetricKeysRequiringSignProfile } from "@/backend/config/factors/blueprints";
import { db } from "@/backend/config/db";
import type { SecMetricKey } from "@/shared/sec/metrics";
import { buildPeriodResolveContext } from "@/backend/services/sec/companyFacts/series/period/resolveContext";
import { resolvePeriod } from "@/backend/services/sec/companyFacts/series/period/resolvePeriod";
import { COMPANY_FACTS_SERIES_TAG_META } from "@/backend/services/sec/companyFacts/series/tagMeta";
import type {
  CompanyFiscalProfile,
  CompanyMetricExpectedSign,
  CompanyMetricSignProfile,
  CompanyMetricSignProfileKind,
} from "@/backend/services/sec/companyFacts/series/fiscal/types";
import type { PeriodKind } from "@/backend/services/sec/companyFacts/series/period/types";

type RawSignProfileRow = {
  cik: string;
  ticker: string | null;
  tag: string;
  unit: string;
  val: number;
  start: Date | string | null;
  end: Date | string;
  filed: Date | string | null;
  accn: string | null;
  fy: number | null;
  fp: string | null;
  form: string | null;
  frame: string | null;
  duration_days: number | null;
};

type SignProfileSample = RawSignProfileRow & {
  metricKey: SecMetricKey;
};

const DOMINANT_RATIO = 0.9;
const MIN_SAMPLE_COUNT = 5;

export async function deriveCompanyMetricSignProfilesForCik(input: {
  ticker: string;
  cik: string;
  fiscalProfile: CompanyFiscalProfile;
  metricKeys?: SecMetricKey[];
}): Promise<CompanyMetricSignProfile[]> {
  const metricKeys =
    input.metricKeys && input.metricKeys.length > 0
      ? input.metricKeys
      : getSecMetricKeysRequiringSignProfile();

  const targetTags = getTargetTags(metricKeys);
  if (targetTags.length === 0) return [];

  const rows = await loadRawRows({
    cik: input.cik,
    tags: targetTags.map((row) => row.tag),
  });

  const metricByTag = new Map(targetTags.map((row) => [row.tag, row.metricKey]));
  const periodContext = buildPeriodResolveContext(input.fiscalProfile);
  const samples: SignProfileSample[] = [];

  for (const row of rows) {
    const metricKey = metricByTag.get(row.tag);
    if (!metricKey) continue;

    const resolvedPeriod = resolvePeriod({
      row,
      fiscalProfile: input.fiscalProfile,
      periodContext,
    });

    if (!isUsableRawDirectObservation(resolvedPeriod.kind, resolvedPeriod.windowMatchKind)) {
      continue;
    }

    samples.push({
      ...row,
      metricKey,
    });
  }

  return buildSignProfiles({
    ticker: input.ticker,
    cik: input.cik,
    samples,
  });
}

function getTargetTags(metricKeys: SecMetricKey[]): Array<{
  tag: string;
  metricKey: SecMetricKey;
}> {
  const metricKeySet = new Set(metricKeys);

  return Object.entries(COMPANY_FACTS_SERIES_TAG_META)
    .filter(([, meta]) => metricKeySet.has(meta.metricKey as SecMetricKey))
    .map(([tag, meta]) => ({
      tag,
      metricKey: meta.metricKey as SecMetricKey,
    }));
}

async function loadRawRows(input: {
  cik: string;
  tags: string[];
}): Promise<RawSignProfileRow[]> {
  const result = await db.query<RawSignProfileRow>(
    `
    SELECT
      cik,
      NULL::text AS ticker,
      tag,
      unit,
      val,
      start,
      "end",
      filed,
      accn,
      fy,
      fp,
      form,
      frame,
      ("end"::date - start::date + 1)::int AS duration_days
    FROM public.sec_companyfact_raw
    WHERE cik = $1
      AND tag = ANY($2::text[])
      AND start IS NOT NULL
      AND "end" IS NOT NULL
      AND val IS NOT NULL
      AND unit IS NOT NULL
      AND form IN ('10-K', '10-K/A', '10-Q', '10-Q/A', '20-F', '20-F/A', '40-F', '40-F/A')
    ORDER BY tag ASC, unit ASC, "end" ASC, start ASC, filed ASC NULLS FIRST
    `,
    [input.cik, input.tags],
  );

  return result.rows;
}

function isUsableRawDirectObservation(
  kind: PeriodKind,
  windowMatchKind: string | null | undefined,
): boolean {
  if (!["annual", "quarter", "ytd"].includes(kind)) return false;
  return windowMatchKind === "exact" || windowMatchKind === "near";
}

function buildSignProfiles(input: {
  ticker: string;
  cik: string;
  samples: SignProfileSample[];
}): CompanyMetricSignProfile[] {
  const grouped = new Map<string, SignProfileSample[]>();

  for (const sample of input.samples) {
    const key = [sample.metricKey, sample.tag, sample.unit].join("|");
    const list = grouped.get(key) ?? [];
    list.push(sample);
    grouped.set(key, list);
  }

  return [...grouped.values()].map((samples) =>
    summarizeSignProfile({
      ticker: input.ticker,
      cik: input.cik,
      samples,
    }),
  );
}

function summarizeSignProfile(input: {
  ticker: string;
  cik: string;
  samples: SignProfileSample[];
}): CompanyMetricSignProfile {
  const [first] = input.samples;
  const sorted = [...input.samples].sort((a, b) =>
    toDateKey(a.end).localeCompare(toDateKey(b.end)),
  );

  const positiveCount = input.samples.filter((row) => Number(row.val) > 0).length;
  const negativeCount = input.samples.filter((row) => Number(row.val) < 0).length;
  const zeroCount = input.samples.filter((row) => Number(row.val) === 0).length;
  const sampleCount = positiveCount + negativeCount + zeroCount;
  const positiveRatio = sampleCount > 0 ? positiveCount / sampleCount : null;
  const negativeRatio = sampleCount > 0 ? negativeCount / sampleCount : null;
  const signProfile = classifySignProfile({
    sampleCount,
    positiveRatio,
    negativeRatio,
    zeroCount,
  });

  return {
    cik: input.cik,
    ticker: input.ticker,
    metricKey: first?.metricKey ?? "",
    tag: first?.tag ?? "",
    unit: first?.unit ?? "",
    signProfile,
    expectedSign: expectedSignFromProfile(signProfile),
    sampleCount,
    positiveCount,
    negativeCount,
    zeroCount,
    positiveRatio,
    negativeRatio,
    firstEnd: sorted[0] ? toDateKey(sorted[0].end) : null,
    latestEnd: sorted.at(-1) ? toDateKey(sorted.at(-1)!.end) : null,
    confidence: confidenceForProfile({
      signProfile,
      sampleCount,
      positiveRatio,
      negativeRatio,
    }),
    sourceScope: "raw_direct_10k_10q",
    notes: {
      dominantRatio: DOMINANT_RATIO,
      minSampleCount: MIN_SAMPLE_COUNT,
    },
  };
}

function classifySignProfile(input: {
  sampleCount: number;
  positiveRatio: number | null;
  negativeRatio: number | null;
  zeroCount: number;
}): CompanyMetricSignProfileKind {
  if (input.sampleCount === 0) return "unknown";
  if (input.zeroCount === input.sampleCount) return "zero_or_sparse";
  if (input.sampleCount < MIN_SAMPLE_COUNT) return "unknown";

  if ((input.positiveRatio ?? 0) >= DOMINANT_RATIO) {
    return "positive_dominant";
  }

  if ((input.negativeRatio ?? 0) >= DOMINANT_RATIO) {
    return "negative_dominant";
  }

  return "mixed";
}

function expectedSignFromProfile(
  profile: CompanyMetricSignProfileKind,
): CompanyMetricExpectedSign {
  switch (profile) {
    case "positive_dominant":
      return "positive";
    case "negative_dominant":
      return "negative";
    case "mixed":
      return "mixed";
    default:
      return "unknown";
  }
}

function confidenceForProfile(input: {
  signProfile: CompanyMetricSignProfileKind;
  sampleCount: number;
  positiveRatio: number | null;
  negativeRatio: number | null;
}): number {
  if (input.signProfile === "unknown" || input.signProfile === "zero_or_sparse") {
    return 0;
  }

  const dominance = Math.max(input.positiveRatio ?? 0, input.negativeRatio ?? 0);
  const sampleConfidence = Math.min(input.sampleCount / 20, 1);

  return Number((dominance * sampleConfidence).toFixed(4));
}

function toDateKey(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}
