import { db } from "@/backend/config/db";
import { getTickerSignalCombinationOverview } from "@/backend/services/ticker-signal-combinations/getTickerSignalCombinationOverview";
import {
  SIGNAL_TIMELINE_AXIS_SCOPE_OPTIONS,
  SIGNAL_TIMELINE_AXIS_SCOPES,
  type SignalTimelineAxisScope,
  TickerSignalCombinationTimelineAnalysis,
  TickerSignalCombinationTimelineOverview,
  TickerSignalCombinationTimelinePiece,
  TickerSignalCombinationTimelineSnapshot,
} from "@/shared/market/signalCombinationTimeline";

export type GetTickerSignalCombinationTimelineInput = {
  years?: number;
  includeLatest?: boolean;
  refresh?: boolean;
  axisScope?: SignalTimelineAxisScope;
};

const CACHE_TTL_MS = 10 * 60 * 1000;
const DEFAULT_LOOKBACK_YEARS = 30;
const TIMELINE_FREQUENCY = "quarter_end";
const MIN_AXIS_TICKER_COVERAGE_RATIO = 0.5;

type TimelineCacheEntry = {
  cachedAt: number;
  overview: TickerSignalCombinationTimelineOverview;
};

type TimelineCacheGlobal = typeof globalThis & {
  __geoPortfolioSignalCombinationTimelineCache?: Map<string, TimelineCacheEntry>;
};

type TimelineSnapshotRow = {
  as_of_date: Date | string;
  snapshot_label: string;
  ticker_count: number | string;
  group_count: number | string;
  signal_dimension_count: number | string;
  analysis: unknown;
  split_views: NonNullable<TickerSignalCombinationTimelineSnapshot["splitViews"]>;
  baseline_signals: TickerSignalCombinationTimelineSnapshot["baselineSignals"];
  boundary_signals: TickerSignalCombinationTimelineSnapshot["boundarySignals"];
  largest_pieces: TickerSignalCombinationTimelinePiece[];
  computed_at: Date | string;
};

const timelineCacheGlobal = globalThis as TimelineCacheGlobal;

export async function getTickerSignalCombinationTimeline(
  input: GetTickerSignalCombinationTimelineInput = {},
): Promise<TickerSignalCombinationTimelineOverview> {
  const years = clampInteger(input.years ?? DEFAULT_LOOKBACK_YEARS, 1, 30);
  const includeLatest = input.includeLatest ?? true;
  const axisScope = normalizeAxisScope(input.axisScope);
  const cacheKey = `${axisScope}:${TIMELINE_FREQUENCY}:${years}:${includeLatest ? "latest" : "year-end"}`;
  const cached = getTimelineCache().get(cacheKey);

  if (!input.refresh && cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.overview;
  }

  const latestSignalDate = includeLatest ? await loadLatestSignalDate() : null;
  const candidateAsOfDates = buildTimelineAsOfDates({
    years,
    latestSignalDate,
    includeLatest,
  });
  const candidateStoredSnapshots = input.refresh
    ? []
    : await loadStoredTimelineSnapshots({
        axisScope,
        years,
        includeLatest,
        asOfDates: candidateAsOfDates,
      });

  if (candidateStoredSnapshots.length > 0) {
    const overview = buildTimelineOverview({
      years,
      axisScope,
      snapshots: candidateStoredSnapshots,
      generatedAt: getLatestComputedAt(candidateStoredSnapshots),
    });

    getTimelineCache().set(cacheKey, {
      cachedAt: Date.now(),
      overview,
    });

    return overview;
  }

  const asOfDates = await filterAsOfDatesByAxisCoverage({
    axisScope,
    asOfDates: candidateAsOfDates,
  });
  const storedSnapshots = input.refresh
    ? []
    : await loadStoredTimelineSnapshots({
        axisScope,
        years,
        includeLatest,
        asOfDates,
      });

  if (storedSnapshots.length === asOfDates.length) {
    const overview = buildTimelineOverview({
      years,
      axisScope,
      snapshots: storedSnapshots,
      generatedAt: getLatestComputedAt(storedSnapshots),
    });

    getTimelineCache().set(cacheKey, {
      cachedAt: Date.now(),
      overview,
    });

    return overview;
  }

  const snapshots: TickerSignalCombinationTimelineSnapshot[] = [];
  const storedSnapshotsByDate = new Map(
    storedSnapshots.map((snapshot) => [snapshot.asOfDate, snapshot]),
  );

  for (const asOfDate of asOfDates) {
    const storedSnapshot = storedSnapshotsByDate.get(asOfDate);

    if (storedSnapshot) {
      snapshots.push(storedSnapshot);
      continue;
    }

    const overview = await getTickerSignalCombinationOverview({
      asOfDate,
      detailMode: "percolation",
      axisScope,
    });
    const firstLargestSplitAnalysis =
      overview.percolationBridgeAnalyses.find(
        (item) =>
          item.lens === "idfWeightedJaccard" &&
          item.label === "IDF Jaccard first largest split",
      ) ?? null;
    const percolationSplitAnalysis =
      overview.percolationBridgeAnalyses.find(
        (item) =>
          item.lens === "idfWeightedJaccard" &&
          item.label === "IDF Jaccard percolation split",
      ) ?? null;
    const analysis =
      percolationSplitAnalysis ??
      firstLargestSplitAnalysis ??
      overview.percolationBridgeAnalyses.find(
        (item) => item.lens === "idfWeightedJaccard",
      ) ??
      null;
    const splitAnalyses = [
      firstLargestSplitAnalysis,
      percolationSplitAnalysis,
    ].filter((item): item is NonNullable<typeof item> => item !== null);
    const splitViews = splitAnalyses.map((item) => ({
      analysis: toTimelineAnalysis(item),
      baselineSignals: item.preBreakBaselineSignals.slice(0, 10),
      boundarySignals: item.topBridgeSignals.slice(0, 5),
      largestPieces: item.postBreakPieces.slice(0, 3).map((piece) => ({
        familyId: piece.familyId,
        groupCount: piece.groupCount,
        tickerCount: piece.tickerCount,
        topSignals: piece.topSignals.slice(0, 5),
      })),
    }));

    const snapshot = {
      asOfDate,
      label: buildSnapshotLabel({ asOfDate, latestSignalDate }),
      tickerCount: overview.tickerCount,
      groupCount: overview.groupCount,
      signalDimensionCount: overview.signalDimensionCount,
      analysis: analysis ? toTimelineAnalysis(analysis) : null,
      splitAnalyses: splitAnalyses.map(toTimelineAnalysis),
      splitViews,
      baselineSignals: analysis?.preBreakBaselineSignals.slice(0, 10) ?? [],
      boundarySignals: analysis?.topBridgeSignals.slice(0, 5) ?? [],
      largestPieces:
        analysis?.postBreakPieces.slice(0, 3).map((piece) => ({
          familyId: piece.familyId,
          groupCount: piece.groupCount,
          tickerCount: piece.tickerCount,
          topSignals: piece.topSignals.slice(0, 5),
        })) ?? [],
    } satisfies TickerSignalCombinationTimelineSnapshot;

    await upsertTimelineSnapshot({
      years,
      includeLatest,
      axisScope,
      snapshot,
    });

    snapshots.push(snapshot);
  }

  const overview = buildTimelineOverview({
    years,
    axisScope,
    snapshots,
    generatedAt: new Date().toISOString(),
  });

  getTimelineCache().set(cacheKey, {
    cachedAt: Date.now(),
    overview,
  });

  return overview;
}

async function loadStoredTimelineSnapshots(input: {
  axisScope: SignalTimelineAxisScope;
  years: number;
  includeLatest: boolean;
  asOfDates: string[];
}): Promise<TickerSignalCombinationTimelineSnapshot[]> {
  if (input.asOfDates.length === 0) return [];

  const result = await db.query<TimelineSnapshotRow>(
    `
      SELECT
        as_of_date,
        snapshot_label,
        ticker_count,
        group_count,
        signal_dimension_count,
        analysis,
        split_views,
        baseline_signals,
        boundary_signals,
        largest_pieces,
        computed_at
      FROM public.ticker_signal_percolation_timeline_snapshots
      WHERE lens = 'idfWeightedJaccard'
        AND axis_scope = $4
        AND frequency = $5
        AND lookback_years = $1
        AND include_latest = $2
        AND source_model_key = 'factor_signal'
        AND source_model_version = 'v0'
        AND as_of_date = ANY($3::date[])
      ORDER BY as_of_date ASC
    `,
    [
      input.years,
      input.includeLatest,
      input.asOfDates,
      input.axisScope,
      TIMELINE_FREQUENCY,
    ],
  );

  return result.rows.map((row) => {
    const analysis = normalizeTimelineAnalysis(row.analysis);
    const splitViews = normalizeSplitViews(row.split_views);

    return {
      asOfDate: toDateKey(row.as_of_date),
      label: row.snapshot_label,
      tickerCount: Number(row.ticker_count),
      groupCount: Number(row.group_count),
      signalDimensionCount: Number(row.signal_dimension_count),
      analysis,
      splitAnalyses: analysis ? [analysis] : [],
      splitViews,
      baselineSignals: row.baseline_signals ?? [],
      boundarySignals: row.boundary_signals ?? [],
      largestPieces: row.largest_pieces ?? [],
    };
  });
}

function normalizeTimelineAnalysis(
  value: unknown,
): TickerSignalCombinationTimelineAnalysis | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<TickerSignalCombinationTimelineAnalysis>;

  if (
    candidate.lens !== "idfWeightedJaccard" ||
    typeof candidate.label !== "string" ||
    typeof candidate.previousThreshold !== "number" ||
    typeof candidate.peakThreshold !== "number" ||
    typeof candidate.peakMoment !== "number" ||
    typeof candidate.largestBeforeSize !== "number" ||
    typeof candidate.largestAfterPieceCount !== "number" ||
    typeof candidate.largestAfterSize !== "number" ||
    typeof candidate.removedEdgeCount !== "number" ||
    typeof candidate.bridgeEdgeCount !== "number"
  ) {
    return null;
  }

  return candidate as TickerSignalCombinationTimelineAnalysis;
}

function normalizeSplitViews(
  value: unknown,
): NonNullable<TickerSignalCombinationTimelineSnapshot["splitViews"]> {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const view = item as NonNullable<
      TickerSignalCombinationTimelineSnapshot["splitViews"]
    >[number];
    const analysis = normalizeTimelineAnalysis(view.analysis);
    if (!analysis) return [];

    return [
      {
        analysis,
        baselineSignals: view.baselineSignals ?? [],
        boundarySignals: view.boundarySignals ?? [],
        largestPieces: view.largestPieces ?? [],
      },
    ];
  });
}

function toTimelineAnalysis(
  analysis: NonNullable<
    Awaited<ReturnType<typeof getTickerSignalCombinationOverview>>[
      "percolationBridgeAnalyses"
    ][number]
  >,
): TickerSignalCombinationTimelineAnalysis {
  return {
    lens: "idfWeightedJaccard",
    label: analysis.label,
    previousThreshold: analysis.previousThreshold,
    peakThreshold: analysis.peakThreshold,
    peakMoment: analysis.peakMoment,
    largestBeforeSize: analysis.largestBeforeSize,
    largestBeforeTickerCount: analysis.largestBeforeTickerCount,
    largestAfterPieceCount: analysis.largestAfterPieceCount,
    largestAfterSize: analysis.largestAfterSize,
    largestAfterTickerCount: analysis.largestAfterTickerCount,
    removedEdgeCount: analysis.removedEdgeCount,
    bridgeEdgeCount: analysis.bridgeEdgeCount,
  };
}

async function upsertTimelineSnapshot(input: {
  years: number;
  includeLatest: boolean;
  axisScope: SignalTimelineAxisScope;
  snapshot: TickerSignalCombinationTimelineSnapshot;
}) {
  await db.query(
    `
      INSERT INTO public.ticker_signal_percolation_timeline_snapshots (
        as_of_date,
        snapshot_label,
        lens,
        axis_scope,
        frequency,
        lookback_years,
        include_latest,
        ticker_count,
        group_count,
        signal_dimension_count,
        analysis,
        split_views,
        baseline_signals,
        boundary_signals,
        largest_pieces
      )
      VALUES (
        $1::date,
        $2,
        'idfWeightedJaccard',
        $13,
        $14,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8::jsonb,
        $9::jsonb,
        $10::jsonb,
        $11::jsonb,
        $12::jsonb
      )
      ON CONFLICT (
        as_of_date,
        lens,
        axis_scope,
        frequency,
        lookback_years,
        include_latest,
        source_model_key,
        source_model_version
      )
      DO UPDATE SET
        snapshot_label = EXCLUDED.snapshot_label,
        ticker_count = EXCLUDED.ticker_count,
        group_count = EXCLUDED.group_count,
        signal_dimension_count = EXCLUDED.signal_dimension_count,
        analysis = EXCLUDED.analysis,
        split_views = EXCLUDED.split_views,
        baseline_signals = EXCLUDED.baseline_signals,
        boundary_signals = EXCLUDED.boundary_signals,
        largest_pieces = EXCLUDED.largest_pieces,
        computed_at = now(),
        updated_at = now()
    `,
    [
      input.snapshot.asOfDate,
      input.snapshot.label,
      input.years,
      input.includeLatest,
      input.snapshot.tickerCount,
      input.snapshot.groupCount,
      input.snapshot.signalDimensionCount,
      JSON.stringify(input.snapshot.analysis ?? {}),
      JSON.stringify(input.snapshot.splitViews ?? []),
      JSON.stringify(input.snapshot.baselineSignals),
      JSON.stringify(input.snapshot.boundarySignals),
      JSON.stringify(input.snapshot.largestPieces),
      input.axisScope,
      TIMELINE_FREQUENCY,
    ],
  );
}

function buildTimelineOverview(input: {
  years: number;
  axisScope: SignalTimelineAxisScope;
  snapshots: TickerSignalCombinationTimelineSnapshot[];
  generatedAt: string;
}): TickerSignalCombinationTimelineOverview {
  return {
    generatedAt: input.generatedAt,
    years: input.years,
    frequency: TIMELINE_FREQUENCY,
    lens: "idfWeightedJaccard",
    axisScope: input.axisScope,
    snapshots: input.snapshots.sort((a, b) => a.asOfDate.localeCompare(b.asOfDate)),
  };
}

function normalizeAxisScope(
  axisScope: SignalTimelineAxisScope | undefined,
): SignalTimelineAxisScope {
  return SIGNAL_TIMELINE_AXIS_SCOPES.includes(axisScope ?? "all")
    ? axisScope ?? "all"
    : "all";
}

function getLatestComputedAt(
  snapshots: TickerSignalCombinationTimelineSnapshot[],
) {
  return snapshots.length > 0 ? new Date().toISOString() : new Date().toISOString();
}

function getTimelineCache() {
  timelineCacheGlobal.__geoPortfolioSignalCombinationTimelineCache ??= new Map();
  return timelineCacheGlobal.__geoPortfolioSignalCombinationTimelineCache;
}

async function loadLatestSignalDate(): Promise<string | null> {
  const result = await db.query<{ max_date: Date | string | null }>(
    `
      SELECT MAX(signal_effective_date) AS max_date
      FROM public.ticker_factor_signals s
      JOIN public.ticker_signal_clustering_question_policies qp
        ON qp.model_key = s.model_key
       AND qp.model_version = s.model_version
       AND qp.factor = s.factor
       AND qp.axis = s.axis
       AND qp.is_active = true
       AND qp.status IN ('use', 'review')
      WHERE s.model_key = 'factor_signal'
        AND s.model_version = 'v0'
        AND s.signal_key IS NOT NULL
    `,
  );

  const value = result.rows[0]?.max_date;
  return value ? toDateKey(value) : null;
}

type AxisCoverageRow = {
  as_of_date: Date | string;
  axis: string;
  ticker_count: number | string;
  directional_signal_count: number | string;
};

async function filterAsOfDatesByAxisCoverage(input: {
  axisScope: SignalTimelineAxisScope;
  asOfDates: string[];
}) {
  if (input.asOfDates.length === 0) return [];

  const axes = resolveAxesForScope(input.axisScope);
  const result = await db.query<AxisCoverageRow>(
    `
      WITH checkpoints AS (
        SELECT unnest($1::date[]) AS as_of_date
      ),
      latest_signals AS (
        SELECT DISTINCT ON (
          c.as_of_date,
          s.ticker,
          s.factor,
          s.axis
        )
          c.as_of_date,
          s.ticker,
          s.factor,
          s.axis,
          s.signal_key
        FROM checkpoints c
        JOIN public.ticker_factor_signals s
          ON s.signal_effective_date <= c.as_of_date
        JOIN public.ticker_signal_clustering_question_policies qp
          ON qp.model_key = s.model_key
         AND qp.model_version = s.model_version
         AND qp.factor = s.factor
         AND qp.axis = s.axis
         AND qp.is_active = true
         AND qp.status IN ('use', 'review')
        WHERE s.model_key = 'factor_signal'
          AND s.model_version = 'v0'
          AND s.signal_key IS NOT NULL
          AND s.axis = ANY($2::text[])
        ORDER BY
          c.as_of_date,
          s.ticker,
          s.factor,
          s.axis,
          s.signal_effective_date DESC,
          s.signal_period_end DESC
      )
      SELECT
        as_of_date,
        axis,
        count(DISTINCT ticker)::integer AS ticker_count,
        count(DISTINCT CASE
          WHEN signal_key NOT LIKE 'mixed_%'
          THEN factor || '.' || axis || '.' || signal_key
        END)::integer AS directional_signal_count
      FROM latest_signals
      GROUP BY as_of_date, axis
      ORDER BY as_of_date, axis
    `,
    [input.asOfDates, axes],
  );
  const coverageByDate = new Map<string, Map<string, AxisCoverageRow>>();

  for (const row of result.rows) {
    const date = toDateKey(row.as_of_date);
    const axisRows = coverageByDate.get(date) ?? new Map<string, AxisCoverageRow>();

    axisRows.set(row.axis, row);
    coverageByDate.set(date, axisRows);
  }

  const latestDate = input.asOfDates.at(-1);
  const latestRows = latestDate ? coverageByDate.get(latestDate) : undefined;
  if (!latestDate || !latestRows) return input.asOfDates;

  return input.asOfDates.filter((asOfDate) => {
    const axisRows = coverageByDate.get(asOfDate);
    if (!axisRows) return false;

    return axes.every((axis) => {
      const row = axisRows.get(axis);
      const latestRow = latestRows.get(axis);
      if (!row || !latestRow) return false;

      const tickerCount = Number(row.ticker_count);
      const latestTickerCount = Number(latestRow.ticker_count);
      const directionalSignalCount = Number(row.directional_signal_count);
      const minTickerCount = Math.ceil(
        latestTickerCount * MIN_AXIS_TICKER_COVERAGE_RATIO,
      );

      return tickerCount >= minTickerCount && directionalSignalCount > 0;
    });
  });
}

function resolveAxesForScope(axisScope: SignalTimelineAxisScope) {
  const option =
    SIGNAL_TIMELINE_AXIS_SCOPE_OPTIONS.find((item) => item.key === axisScope) ??
    SIGNAL_TIMELINE_AXIS_SCOPE_OPTIONS[0];

  return option.axes ?? [
    "fundamentals_based",
    "valuation",
    "market_price",
    "etf_exposure",
    "macro_linked",
  ];
}

function buildSnapshotLabel(input: {
  asOfDate: string;
  latestSignalDate: string | null;
}) {
  if (input.latestSignalDate && input.asOfDate === input.latestSignalDate) {
    return "Latest";
  }

  const year = input.asOfDate.slice(0, 4);
  const monthDay = input.asOfDate.slice(5);

  if (monthDay === "03-31") return `${year} Q1`;
  if (monthDay === "06-30") return `${year} Q2`;
  if (monthDay === "09-30") return `${year} Q3`;
  if (monthDay === "12-31") return `${year} Q4`;

  return year;
}

function buildTimelineAsOfDates(input: {
  years: number;
  includeLatest: boolean;
  latestSignalDate: string | null;
}) {
  const latest = input.latestSignalDate
    ? parseDate(input.latestSignalDate)
    : new Date();
  const latestYear = latest.getUTCFullYear();
  const latestMonth = latest.getUTCMonth() + 1;
  const completedYear = latestMonth === 12 && latest.getUTCDate() === 31
    ? latestYear
    : latestYear - 1;
  const startYear = completedYear - input.years + 1;
  const dates: string[] = [];

  for (let year = startYear; year <= completedYear; year += 1) {
    for (const quarterDate of [
      `${year}-03-31`,
      `${year}-06-30`,
      `${year}-09-30`,
      `${year}-12-31`,
    ]) {
      dates.push(quarterDate);
    }
  }

  if (input.latestSignalDate && latestYear > completedYear) {
    for (const quarterDate of [
      `${latestYear}-03-31`,
      `${latestYear}-06-30`,
      `${latestYear}-09-30`,
      `${latestYear}-12-31`,
    ]) {
      if (quarterDate <= input.latestSignalDate) dates.push(quarterDate);
    }
  }

  if (
    input.includeLatest &&
    input.latestSignalDate &&
    !dates.includes(input.latestSignalDate)
  ) {
    dates.push(input.latestSignalDate);
  }

  return [...new Set(dates)].sort();
}

function clampInteger(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function parseDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid timeline date: ${value}`);
  }

  return date;
}

function toDateKey(value: Date | string) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return parseDate(value).toISOString().slice(0, 10);
}
