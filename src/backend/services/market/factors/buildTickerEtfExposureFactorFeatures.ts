import { db } from "@/backend/config/db";
import type { FactorAxisKey } from "@/shared/factors/axes";
import type { FactorKey } from "@/shared/factors/factors";

export type BuildTickerEtfExposureFactorFeaturesInput = {
  tickers?: string[];
  provider?: string;
  adjustmentPolicy?: string;
  asOfDate?: string;
  onProgress?: (progress: {
    message: string;
    current?: number;
    total?: number;
    label?: string;
  }) => void;
};

export type BuildTickerEtfExposureFactorFeaturesResult = {
  tickerCount: number;
  featureRowCount: number;
  asOfDate: string | null;
  skippedStaleTickerCount: number;
};

export type BuildTickerEtfExposureFactorFeaturesTimelineInput =
  Omit<BuildTickerEtfExposureFactorFeaturesInput, "asOfDate"> & {
    snapshotDates: string[];
  };

export type BuildTickerEtfExposureFactorFeaturesTimelineResult =
  BuildTickerEtfExposureFactorFeaturesResult & {
    snapshotDates: string[];
    completedRuns: number;
  };

type PriceRow = {
  ticker: string;
  price_date: Date | string;
  close: number | string;
};

type PricePoint = {
  ticker: string;
  date: string;
  close: number;
};

type DailyReturnPoint = {
  date: string;
  value: number;
};

type FeatureRow = {
  ticker: string;
  factor: FactorKey;
  axis: FactorAxisKey;
  metricKey: string;
  featureKey: string;
  featureValue: number;
  periodEnd: string;
  effectiveDate: string;
};

type EtfExposureDefinition = {
  factor: FactorKey;
  metricKey: string;
  featureKey: string;
  benchmarkTickers: readonly string[];
};

const DEFAULT_PROVIDER = "twelve_data";
const DEFAULT_ADJUSTMENT_POLICY = "splits";
const ETF_EXPOSURE_AXIS = "etf_exposure" satisfies FactorAxisKey;
const SOURCE_TABLE = "ticker_daily_prices";
const SOURCE_VERSION = "etf_exposure_factor_features_v0";
const THREE_YEAR_DAYS = 756;
const MIN_OBSERVATIONS = 90;
const MAX_PRICE_STALENESS_DAYS = 7;

const ETF_EXPOSURE_FACTORS = [
  "energy_linked",
  "commodity_linked",
  "consumer_linked",
  "inflation_hedge",
  "reshoring_defense",
  "china_exposure",
] as const satisfies FactorKey[];

const ETF_EXPOSURE_DEFINITIONS = [
  {
    factor: "energy_linked",
    metricKey: "energy_sector_beta_3y",
    featureKey: "energySectorBeta3Y",
    benchmarkTickers: ["XLE"],
  },
  {
    factor: "energy_linked",
    metricKey: "energy_exploration_beta_3y",
    featureKey: "energyExplorationBeta3Y",
    benchmarkTickers: ["XOP"],
  },
  {
    factor: "energy_linked",
    metricKey: "oil_services_beta_3y",
    featureKey: "oilServicesBeta3Y",
    benchmarkTickers: ["OIH"],
  },
  {
    factor: "commodity_linked",
    metricKey: "broad_commodity_beta_3y",
    featureKey: "broadCommodityBeta3Y",
    benchmarkTickers: ["DBC"],
  },
  {
    factor: "commodity_linked",
    metricKey: "gold_beta_3y",
    featureKey: "goldBeta3Y",
    benchmarkTickers: ["GLD"],
  },
  {
    factor: "commodity_linked",
    metricKey: "silver_beta_3y",
    featureKey: "silverBeta3Y",
    benchmarkTickers: ["SLV"],
  },
  {
    factor: "consumer_linked",
    metricKey: "consumer_discretionary_beta_3y",
    featureKey: "consumerDiscretionaryBeta3Y",
    benchmarkTickers: ["XLY"],
  },
  {
    factor: "consumer_linked",
    metricKey: "consumer_staples_beta_3y",
    featureKey: "consumerStaplesBeta3Y",
    benchmarkTickers: ["XLP"],
  },
  {
    factor: "consumer_linked",
    metricKey: "retail_beta_3y",
    featureKey: "retailBeta3Y",
    benchmarkTickers: ["XRT"],
  },
  {
    factor: "inflation_hedge",
    metricKey: "inflation_hedge_basket_beta_3y",
    featureKey: "inflationHedgeBasketBeta3Y",
    benchmarkTickers: ["GLD", "DBC", "XLE"],
  },
  {
    factor: "reshoring_defense",
    metricKey: "aerospace_defense_beta_3y",
    featureKey: "aerospaceDefenseBeta3Y",
    benchmarkTickers: ["ITA", "PPA"],
  },
  {
    factor: "reshoring_defense",
    metricKey: "infrastructure_beta_3y",
    featureKey: "infrastructureBeta3Y",
    benchmarkTickers: ["PAVE"],
  },
  {
    factor: "reshoring_defense",
    metricKey: "power_grid_beta_3y",
    featureKey: "powerGridBeta3Y",
    benchmarkTickers: ["GRID"],
  },
  {
    factor: "china_exposure",
    metricKey: "china_large_cap_beta_3y",
    featureKey: "chinaLargeCapBeta3Y",
    benchmarkTickers: ["FXI", "MCHI"],
  },
  {
    factor: "china_exposure",
    metricKey: "china_internet_beta_3y",
    featureKey: "chinaInternetBeta3Y",
    benchmarkTickers: ["KWEB"],
  },
  {
    factor: "china_exposure",
    metricKey: "emerging_market_beta_3y",
    featureKey: "emergingMarketBeta3Y",
    benchmarkTickers: ["EEM"],
  },
] as const satisfies readonly EtfExposureDefinition[];

const ETF_PROXY_TICKERS = [
  ...new Set(ETF_EXPOSURE_DEFINITIONS.flatMap((definition) => definition.benchmarkTickers)),
];

export async function buildTickerEtfExposureFactorFeatures(
  input: BuildTickerEtfExposureFactorFeaturesInput = {},
): Promise<BuildTickerEtfExposureFactorFeaturesResult> {
  const provider = input.provider ?? DEFAULT_PROVIDER;
  const adjustmentPolicy = input.adjustmentPolicy ?? DEFAULT_ADJUSTMENT_POLICY;
  const pointsByTicker = await loadPricePoints({
    tickers: input.tickers,
    provider,
    adjustmentPolicy,
    asOfDate: input.asOfDate,
  });
  const referenceAsOfDate =
    input.asOfDate ??
    await loadReferenceAsOfDate({
      provider,
      adjustmentPolicy,
      asOfDate: input.asOfDate,
    });
  const returnsByTicker = buildReturnsByTicker(pointsByTicker);
  const rows: FeatureRow[] = [];
  const candidateEntries = Array.from(pointsByTicker.entries())
    .filter(([ticker]) => !isEtfProxyTicker(ticker))
    .sort(([a], [b]) => a.localeCompare(b));
  const entries = referenceAsOfDate
    ? candidateEntries.filter(([, points]) =>
        isFreshPriceSeries(points, referenceAsOfDate),
      )
    : candidateEntries;
  const staleTickers = referenceAsOfDate
    ? candidateEntries
        .filter(([, points]) => !isFreshPriceSeries(points, referenceAsOfDate))
        .map(([ticker]) => ticker)
    : [];

  if (staleTickers.length > 0) {
    input.onProgress?.({
      message: `Skipping stale ETF exposure feature inputs. referenceAsOf=${referenceAsOfDate}, maxStalenessDays=${MAX_PRICE_STALENESS_DAYS}, skipped=${staleTickers.length}.`,
      current: 0,
      total: staleTickers.length,
    });
  }

  for (const [index, [ticker, points]] of entries.entries()) {
    input.onProgress?.({
      message: `[${index + 1}/${entries.length}] Building ${ticker}.`,
      current: index + 1,
      total: entries.length,
      label: ticker,
    });

    const latest = points.at(-1);
    if (!latest) continue;

    const tickerReturns = buildDailyLogReturns(points).slice(-THREE_YEAR_DAYS);

    for (const definition of ETF_EXPOSURE_DEFINITIONS) {
      const benchmarkReturns = buildBasketReturns({
        tickers: definition.benchmarkTickers,
        returnsByTicker,
      }).slice(-THREE_YEAR_DAYS);
      const beta = calcBeta(buildBenchmarkPairs({
        returns: tickerReturns,
        benchmarkReturns,
      }));

      addFeature(rows, ticker, definition, beta, latest.date);
    }
  }

  await deleteExistingRowsForEffectiveDates({
    tickers: entries.map(([ticker]) => ticker),
    effectiveDates: getDistinctEffectiveDates(rows),
  });
  await deleteExistingRowsForTickersAtEffectiveDate({
    tickers: staleTickers,
    effectiveDate: referenceAsOfDate,
  });
  await upsertFeatureRows(rows);

  return {
    tickerCount: entries.length,
    featureRowCount: rows.length,
    asOfDate: getLatestDate(entries.flatMap(([, points]) => points)),
    skippedStaleTickerCount: staleTickers.length,
  };
}

export async function buildTickerEtfExposureFactorFeaturesTimeline(
  input: BuildTickerEtfExposureFactorFeaturesTimelineInput,
): Promise<BuildTickerEtfExposureFactorFeaturesTimelineResult> {
  const snapshotDates = Array.from(new Set(input.snapshotDates)).sort();
  if (snapshotDates.length === 0) {
    return {
      tickerCount: 0,
      featureRowCount: 0,
      asOfDate: null,
      skippedStaleTickerCount: 0,
      snapshotDates,
      completedRuns: 0,
    };
  }

  const provider = input.provider ?? DEFAULT_PROVIDER;
  const adjustmentPolicy = input.adjustmentPolicy ?? DEFAULT_ADJUSTMENT_POLICY;
  const maxSnapshotDate = snapshotDates.at(-1);
  const allPointsByTicker = await loadPricePoints({
    tickers: input.tickers,
    provider,
    adjustmentPolicy,
    asOfDate: maxSnapshotDate,
  });
  const contexts = snapshotDates.map((snapshotDate, snapshotIndex) => {
    input.onProgress?.({
      message: `[${snapshotIndex + 1}/${snapshotDates.length}] Preparing ETF exposure snapshot ${snapshotDate}.`,
      current: snapshotIndex + 1,
      total: snapshotDates.length,
      label: snapshotDate,
    });

    const pointsByTicker = slicePointsByTickerAtDate(allPointsByTicker, snapshotDate);
    const returnsByTicker = buildReturnsByTicker(pointsByTicker);
    const basketReturnsByDefinition = buildBasketReturnsByDefinition(returnsByTicker);
    const candidateEntries = Array.from(pointsByTicker.entries())
      .filter(([ticker]) => !isEtfProxyTicker(ticker))
      .sort(([a], [b]) => a.localeCompare(b));
    const referenceAsOfDate = getLatestDate(
      candidateEntries.flatMap(([, points]) => points),
    );
    const entries = referenceAsOfDate
      ? candidateEntries.filter(([, points]) =>
          isFreshPriceSeries(points, referenceAsOfDate),
        )
      : candidateEntries;
    const staleTickers = referenceAsOfDate
      ? candidateEntries
          .filter(([, points]) => !isFreshPriceSeries(points, referenceAsOfDate))
          .map(([ticker]) => ticker)
      : [];
    const entriesByTicker = new Map(entries);

    if (staleTickers.length > 0) {
      input.onProgress?.({
        message: `Skipping stale ETF exposure feature inputs. referenceAsOf=${referenceAsOfDate}, maxStalenessDays=${MAX_PRICE_STALENESS_DAYS}, skipped=${staleTickers.length}.`,
        current: 0,
        total: staleTickers.length,
      });
    }

    return {
      snapshotDate,
      basketReturnsByDefinition,
      referenceAsOfDate,
      entries,
      entriesByTicker,
      staleTickers,
    };
  });

  const timelineTickers = Array.from(
    new Set(contexts.flatMap((context) => context.entries.map(([ticker]) => ticker))),
  ).sort();
  const effectiveDates = Array.from(
    new Set(contexts.flatMap((context) => context.referenceAsOfDate ?? [])),
  ).sort();

  await deleteExistingRowsForEffectiveDates({
    tickers: timelineTickers,
    effectiveDates,
  });

  let featureRowCount = 0;

  for (const [index, ticker] of timelineTickers.entries()) {
    input.onProgress?.({
      message: `[${index + 1}/${timelineTickers.length}] Building ${ticker} ETF exposure timeline.`,
      current: index + 1,
      total: timelineTickers.length,
      label: ticker,
    });

    const rows: FeatureRow[] = [];

    for (const context of contexts) {
      const points = context.entriesByTicker.get(ticker);
      if (!points) continue;

      const latest = points.at(-1);
      if (!latest) continue;

      const tickerReturns = buildDailyLogReturns(points).slice(-THREE_YEAR_DAYS);

      for (const definition of ETF_EXPOSURE_DEFINITIONS) {
        const benchmarkReturns =
          context.basketReturnsByDefinition.get(definition.featureKey) ?? [];
        const beta = calcBeta(buildBenchmarkPairs({
          returns: tickerReturns,
          benchmarkReturns,
        }));

        addFeature(rows, ticker, definition, beta, latest.date);
      }
    }

    await upsertFeatureRows(rows);
    featureRowCount += rows.length;
  }

  return {
    tickerCount: timelineTickers.length,
    featureRowCount,
    asOfDate: contexts.at(-1)?.referenceAsOfDate ?? null,
    skippedStaleTickerCount: contexts.reduce(
      (sum, context) => sum + context.staleTickers.length,
      0,
    ),
    snapshotDates,
    completedRuns: snapshotDates.length,
  };
}

async function loadReferenceAsOfDate(input: {
  provider: string;
  adjustmentPolicy: string;
  asOfDate?: string;
}): Promise<string | null> {
  const result = await db.query<{ max_price_date: Date | string | null }>(
    `
    SELECT MAX(price_date) AS max_price_date
    FROM public.ticker_daily_prices
    WHERE provider = $1
      AND adjustment_policy = $2
      AND ($3::date IS NULL OR price_date <= $3::date)
    `,
    [input.provider, input.adjustmentPolicy, input.asOfDate ?? null],
  );

  return result.rows[0]?.max_price_date
    ? toIsoDate(result.rows[0].max_price_date)
    : null;
}

async function loadPricePoints(input: {
  tickers?: string[];
  provider: string;
  adjustmentPolicy: string;
  asOfDate?: string;
}): Promise<Map<string, PricePoint[]>> {
  const requestedTickers =
    input.tickers?.map(normalizeTicker).filter(Boolean) ?? [];
  const tickers =
    requestedTickers.length > 0
      ? [...new Set([...requestedTickers, ...ETF_PROXY_TICKERS])]
      : [];
  const result = await db.query<PriceRow>(
    `
    SELECT ticker, price_date, close
    FROM public.ticker_daily_prices
    WHERE provider = $1
      AND adjustment_policy = $2
      AND ($3::date IS NULL OR price_date <= $3::date)
      AND ($4::text[] IS NULL OR ticker = ANY($4::text[]))
    ORDER BY ticker ASC, price_date ASC
    `,
    [
      input.provider,
      input.adjustmentPolicy,
      input.asOfDate ?? null,
      tickers.length > 0 ? tickers : null,
    ],
  );

  const grouped = new Map<string, PricePoint[]>();

  for (const row of result.rows) {
    const close = Number(row.close);
    if (!Number.isFinite(close) || close <= 0) continue;

    const ticker = normalizeTicker(row.ticker);
    grouped.set(ticker, [
      ...(grouped.get(ticker) ?? []),
      {
        ticker,
        date: toIsoDate(row.price_date),
        close,
      },
    ]);
  }

  return new Map(
    Array.from(grouped.entries()).filter(
      ([, points]) => points.length >= THREE_YEAR_DAYS,
    ),
  );
}

function slicePointsByTickerAtDate(
  pointsByTicker: Map<string, PricePoint[]>,
  asOfDate: string,
): Map<string, PricePoint[]> {
  return new Map(
    Array.from(pointsByTicker.entries()).flatMap(([ticker, points]) => {
      const sliced = points.filter((point) => point.date <= asOfDate);
      if (sliced.length < THREE_YEAR_DAYS) return [];
      return [[ticker, sliced]];
    }),
  );
}

function buildReturnsByTicker(
  pointsByTicker: Map<string, PricePoint[]>,
): Map<string, DailyReturnPoint[]> {
  return new Map(
    Array.from(pointsByTicker.entries()).map(([ticker, points]) => [
      ticker,
      buildDailyLogReturns(points),
    ]),
  );
}

function buildDailyLogReturns(points: PricePoint[]): DailyReturnPoint[] {
  const output: DailyReturnPoint[] = [];

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (!previous || !current || previous.close <= 0 || current.close <= 0) {
      continue;
    }

    output.push({
      date: current.date,
      value: Math.log(current.close / previous.close),
    });
  }

  return output;
}

function buildBasketReturns(input: {
  tickers: readonly string[];
  returnsByTicker: Map<string, DailyReturnPoint[]>;
}): DailyReturnPoint[] {
  const valuesByDate = new Map<string, number[]>();

  for (const ticker of input.tickers) {
    for (const point of input.returnsByTicker.get(ticker) ?? []) {
      valuesByDate.set(point.date, [
        ...(valuesByDate.get(point.date) ?? []),
        point.value,
      ]);
    }
  }

  return Array.from(valuesByDate.entries())
    .filter(([, values]) => values.length > 0)
    .map(([date, values]) => ({
      date,
      value: values.reduce((sum, value) => sum + value, 0) / values.length,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function buildBasketReturnsByDefinition(
  returnsByTicker: Map<string, DailyReturnPoint[]>,
): Map<string, DailyReturnPoint[]> {
  return new Map(
    ETF_EXPOSURE_DEFINITIONS.map((definition) => [
      definition.featureKey,
      buildBasketReturns({
        tickers: definition.benchmarkTickers,
        returnsByTicker,
      }).slice(-THREE_YEAR_DAYS),
    ]),
  );
}

function buildBenchmarkPairs(input: {
  returns: DailyReturnPoint[];
  benchmarkReturns: DailyReturnPoint[];
}): Array<{ stock: number; benchmark: number }> {
  const benchmarkReturnsByDate = new Map(
    input.benchmarkReturns.map((point) => [point.date, point.value]),
  );

  return input.returns.flatMap((point) => {
    const benchmark = benchmarkReturnsByDate.get(point.date);
    if (benchmark === undefined || !Number.isFinite(benchmark)) return [];
    return [{ stock: point.value, benchmark }];
  });
}

function calcBeta(
  pairs: Array<{ stock: number; benchmark: number }>,
): number | null {
  if (pairs.length < MIN_OBSERVATIONS) return null;

  const benchmarkValues = pairs.map((pair) => pair.benchmark);
  const variance = sampleVariance(benchmarkValues);
  if (variance === null || variance === 0) return null;

  return covariance(
    pairs.map((pair) => pair.stock),
    benchmarkValues,
  ) / variance;
}

function sampleVariance(values: number[]): number | null {
  if (values.length < 2) return null;

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const sumSquares = values.reduce(
    (sum, value) => sum + (value - mean) ** 2,
    0,
  );

  return sumSquares / (values.length - 1);
}

function covariance(left: number[], right: number[]): number {
  const length = Math.min(left.length, right.length);
  const leftMean =
    left.slice(0, length).reduce((sum, value) => sum + value, 0) / length;
  const rightMean =
    right.slice(0, length).reduce((sum, value) => sum + value, 0) / length;
  let sum = 0;

  for (let index = 0; index < length; index += 1) {
    sum += ((left[index] ?? 0) - leftMean) * ((right[index] ?? 0) - rightMean);
  }

  return sum / (length - 1);
}

function addFeature(
  rows: FeatureRow[],
  ticker: string,
  definition: EtfExposureDefinition,
  featureValue: number | null,
  periodEnd: string,
) {
  if (featureValue === null || !Number.isFinite(featureValue)) return;

  rows.push({
    ticker,
    factor: definition.factor,
    axis: ETF_EXPOSURE_AXIS,
    metricKey: definition.metricKey,
    featureKey: definition.featureKey,
    featureValue,
    periodEnd,
    effectiveDate: periodEnd,
  });
}

function getDistinctEffectiveDates(rows: FeatureRow[]): string[] {
  return [...new Set(rows.map((row) => row.effectiveDate))].sort();
}

async function deleteExistingRowsForEffectiveDates(input: {
  tickers: string[];
  effectiveDates: string[];
}): Promise<void> {
  if (input.tickers.length === 0 || input.effectiveDates.length === 0) return;

  await db.query(
    `
    DELETE FROM public.ticker_factor_metric_features
    WHERE axis = $1
      AND factor = ANY($2::text[])
      AND ticker = ANY($3::text[])
      AND effective_date = ANY($4::date[])
    `,
    [
      ETF_EXPOSURE_AXIS,
      [...ETF_EXPOSURE_FACTORS],
      input.tickers,
      input.effectiveDates,
    ],
  );
}

async function deleteExistingRowsForTickersAtEffectiveDate(input: {
  tickers: string[];
  effectiveDate: string | null;
}): Promise<void> {
  if (input.tickers.length === 0 || !input.effectiveDate) return;

  await db.query(
    `
    DELETE FROM public.ticker_factor_metric_features
    WHERE axis = $1
      AND factor = ANY($2::text[])
      AND ticker = ANY($3::text[])
      AND effective_date = $4::date
    `,
    [
      ETF_EXPOSURE_AXIS,
      [...ETF_EXPOSURE_FACTORS],
      input.tickers,
      input.effectiveDate,
    ],
  );
}

async function upsertFeatureRows(rows: FeatureRow[]): Promise<void> {
  if (rows.length === 0) return;

  for (let index = 0; index < rows.length; index += 500) {
    await upsertFeatureRowsChunk(rows.slice(index, index + 500));
  }
}

async function upsertFeatureRowsChunk(rows: FeatureRow[]): Promise<void> {
  const values: unknown[] = [];
  const placeholders = rows.map((row, index) => {
    const offset = index * 11;

    values.push(
      row.ticker,
      null,
      row.factor,
      row.axis,
      row.metricKey,
      row.featureKey,
      row.featureValue,
      row.periodEnd,
      row.effectiveDate,
      SOURCE_TABLE,
      SOURCE_VERSION,
    );

    return `($${offset + 1},$${offset + 2},$${offset + 3},$${offset + 4},$${offset + 5},$${offset + 6},$${offset + 7},$${offset + 8},$${offset + 9},$${offset + 10},$${offset + 11})`;
  });

  await db.query(
    `
    INSERT INTO public.ticker_factor_metric_features (
      ticker,
      cik,
      factor,
      axis,
      metric_key,
      feature_key,
      feature_value,
      period_end,
      effective_date,
      source_table,
      source_version
    )
    VALUES ${placeholders.join(",")}
    ON CONFLICT (
      ticker,
      factor,
      axis,
      metric_key,
      feature_key,
      period_end,
      effective_date
    )
    DO UPDATE SET
      cik = EXCLUDED.cik,
      feature_value = EXCLUDED.feature_value,
      source_table = EXCLUDED.source_table,
      source_version = EXCLUDED.source_version,
      updated_at = now()
    `,
    values,
  );
}

function getLatestDate(points: PricePoint[]): string | null {
  return points.reduce<string | null>(
    (latest, point) => (!latest || point.date > latest ? point.date : latest),
    null,
  );
}

function isFreshPriceSeries(
  points: PricePoint[],
  referenceAsOfDate: string,
): boolean {
  const latestDate = points.at(-1)?.date;
  if (!latestDate) return false;

  return daysBetween(latestDate, referenceAsOfDate) <= MAX_PRICE_STALENESS_DAYS;
}

function daysBetween(leftDate: string, rightDate: string): number {
  const left = Date.parse(`${leftDate}T00:00:00.000Z`);
  const right = Date.parse(`${rightDate}T00:00:00.000Z`);
  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.abs(right - left) / 86_400_000;
}

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

function isEtfProxyTicker(ticker: string): boolean {
  return (ETF_PROXY_TICKERS as readonly string[]).includes(
    normalizeTicker(ticker),
  );
}

function toIsoDate(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return new Date(value).toISOString().slice(0, 10);
}
