import { db } from "@/backend/config/db";
import type { FactorAxisKey } from "@/shared/factors/axes";
import type { FactorKey } from "@/shared/factors/factors";

export type BuildTickerMarketPriceFactorFeaturesInput = {
  tickers?: string[];
  provider?: string;
  adjustmentPolicy?: string;
  asOfDate?: string;
  onProgress?: (progress: {
    message: string;
    level?: "info" | "warning" | "error";
    current?: number;
    total?: number;
    label?: string;
  }) => void;
};

export type BuildTickerMarketPriceFactorFeaturesResult = {
  tickerCount: number;
  featureRowCount: number;
  asOfDate: string | null;
  skippedStaleTickerCount: number;
};

export type BuildTickerMarketPriceFactorFeaturesTimelineInput =
  Omit<BuildTickerMarketPriceFactorFeaturesInput, "asOfDate"> & {
    snapshotDates: string[];
  };

export type BuildTickerMarketPriceFactorFeaturesTimelineResult =
  BuildTickerMarketPriceFactorFeaturesResult & {
    snapshotDates: string[];
    completedRuns: number;
  };

type PriceRow = {
  ticker: string;
  price_date: Date | string;
  close: number | string;
  volume: number | string | null;
};

type PricePoint = {
  ticker: string;
  date: string;
  close: number;
  volume: number | null;
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

const DEFAULT_PROVIDER = "twelve_data";
const DEFAULT_ADJUSTMENT_POLICY = "splits";
const MARKET_PRICE_AXIS = "market_price" satisfies FactorAxisKey;
const MARKET_PRICE_FACTORS = [
  "defensive",
  "momentum",
  "low_volatility",
  "high_beta",
  "rate_sensitive",
  "credit_sensitive",
  "duration_sensitive",
] as const satisfies FactorKey[];
const PRICE_METRIC_KEY = "price";
const MARKET_PRICE_FEATURE_METRIC_KEYS: Record<string, string> = {
  downMarketDefense1Y: "down_market_defense_1y",
  downMarketDefense3Y: "down_market_defense_3y",
  volatilityStressDefense1Y: "volatility_stress_defense_1y",
  volatilityStressDefense3Y: "volatility_stress_defense_3y",
  drawdownDefense1Y: "drawdown_defense_1y",
  downsideCaptureDefense1Y: "downside_capture_defense_1y",
  priceReturn3M: "price_return_3m",
  priceReturn6M: "price_return_6m",
  priceReturn12M: "price_return_12m",
  priceMomentum12MEx1M: "price_momentum_12m_ex_1m",
  relativeReturn3M: "relative_return_3m",
  relativeReturn6M: "relative_return_6m",
  relativeReturn12M: "relative_return_12m",
  relativeMomentum12MEx1M: "relative_momentum_12m_ex_1m",
  momentumConsistency12M: "momentum_consistency_12m",
  distanceFrom52WeekHigh: "distance_from_52_week_high",
  realizedVolatility1Y: "realized_volatility_1y",
  realizedVolatility3Y: "realized_volatility_3y",
  downsideVolatility1Y: "downside_volatility_1y",
  maxDrawdown1Y: "max_drawdown_1y",
  marketBeta1Y: "market_beta_1y",
  marketBeta3Y: "market_beta_3y",
  correlationToMarket3Y: "correlation_to_market_3y",
  upsideCapture1Y: "upside_capture_1y",
  downsideCapture1Y: "downside_capture_1y",
  qqqBeta1Y: "qqq_beta_1y",
  qqqBeta3Y: "qqq_beta_3y",
  qqqCorrelation3Y: "qqq_correlation_3y",
  diaBeta1Y: "dia_beta_1y",
  diaBeta3Y: "dia_beta_3y",
  diaCorrelation3Y: "dia_correlation_3y",
  rateUpRelativeReturn1Y: "rate_up_relative_return_1y",
  rateUpRelativeReturn3Y: "rate_up_relative_return_3y",
  rateShockRelativeReturn1Y: "rate_shock_relative_return_1y",
  rateBeta3Y: "rate_beta_3y",
  curveFlatteningRelativeReturn3Y: "curve_flattening_relative_return_3y",
  creditSpreadWideningRelativeReturn1Y:
    "credit_spread_widening_relative_return_1y",
  creditSpreadWideningRelativeReturn3Y:
    "credit_spread_widening_relative_return_3y",
  creditShockRelativeReturn1Y: "credit_shock_relative_return_1y",
  highYieldSpreadBeta3Y: "high_yield_spread_beta_3y",
  investmentGradeSpreadBeta3Y: "investment_grade_spread_beta_3y",
  shortRateBeta3Y: "short_rate_beta_3y",
  intermediateRateBeta3Y: "intermediate_rate_beta_3y",
  ultraLongRateBeta3Y: "ultra_long_rate_beta_3y",
  yieldCurveBeta3Y: "yield_curve_beta_3y",
  shortTreasuryBeta3Y: "short_treasury_beta_3y",
  intermediateTreasuryBeta3Y: "intermediate_treasury_beta_3y",
  longBondBeta3Y: "long_bond_beta_3y",
};
const SOURCE_TABLE = "ticker_daily_prices";
const SOURCE_VERSION = "market_price_factor_features_v0";
const BENCHMARK_TICKERS = ["SPY", "QQQ", "DIA", "SHY", "IEF", "TLT"] as const;
const TRADING_DAYS_PER_YEAR = 252;
const ONE_MONTH_DAYS = 21;
const THREE_MONTH_DAYS = 63;
const SIX_MONTH_DAYS = 126;
const ONE_YEAR_DAYS = 252;
const THREE_YEAR_DAYS = 756;
const VIX_STRESS_THRESHOLD = 25;
const RATE_SHOCK_THRESHOLD = 0.0005;
const CREDIT_SHOCK_THRESHOLD = 0.001;
const MAX_PRICE_STALENESS_DAYS = 7;

export async function buildTickerMarketPriceFactorFeatures(
  input: BuildTickerMarketPriceFactorFeaturesInput = {},
): Promise<BuildTickerMarketPriceFactorFeaturesResult> {
  const provider = input.provider ?? DEFAULT_PROVIDER;
  const adjustmentPolicy = input.adjustmentPolicy ?? DEFAULT_ADJUSTMENT_POLICY;
  const pointsByTicker = await loadPricePoints({
    tickers: input.tickers,
    provider,
    adjustmentPolicy,
    asOfDate: input.asOfDate,
  });
  const marketReferenceAsOfDate = await loadReferenceAsOfDate({
    provider,
    adjustmentPolicy,
    asOfDate: input.asOfDate,
  });
  const vixByDate = await loadVixByDate(input.asOfDate);
  const tenYearRateChanges = await loadFredDailyChangesByDate({
    seriesId: "DGS10",
    asOfDate: input.asOfDate,
  });
  const twoYearRateChanges = await loadFredDailyChangesByDate({
    seriesId: "DGS2",
    asOfDate: input.asOfDate,
  });
  const fiveYearRateChanges = await loadFredDailyChangesByDate({
    seriesId: "DGS5",
    asOfDate: input.asOfDate,
  });
  const thirtyYearRateChanges = await loadFredDailyChangesByDate({
    seriesId: "DGS30",
    asOfDate: input.asOfDate,
  });
  const yieldCurveChanges = await loadFredDailyChangesByDate({
    seriesId: "T10Y2Y",
    asOfDate: input.asOfDate,
  });
  const highYieldSpreadChanges = await loadFredDailyChangesByDate({
    seriesId: "BAMLH0A0HYM2",
    asOfDate: input.asOfDate,
  });
  const investmentGradeSpreadChanges = await loadFredDailyChangesByDate({
    seriesId: "BAMLC0A0CM",
    asOfDate: input.asOfDate,
  });
  const benchmarkReturnsByTicker = buildBenchmarkReturnsByTicker(pointsByTicker);
  const rows: FeatureRow[] = [];
  const candidateEntries = Array.from(pointsByTicker.entries())
    .filter(([ticker]) => !isBenchmarkTicker(ticker))
    .sort(([a], [b]) => a.localeCompare(b));
  const referenceAsOfDate =
    input.asOfDate ??
    marketReferenceAsOfDate ??
    getLatestDate(candidateEntries.flatMap(([, points]) => points));
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
      message: `Skipping stale market price feature inputs. referenceAsOf=${referenceAsOfDate}, maxStalenessDays=${MAX_PRICE_STALENESS_DAYS}, skipped=${staleTickers.length}.`,
      level: "warning",
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

    rows.push(
      ...buildTickerFeatureRows({
        ticker,
        points,
        benchmarkPointsByTicker: pointsByTicker,
        benchmarkReturnsByTicker,
        vixByDate,
        twoYearRateChanges,
        fiveYearRateChanges,
        tenYearRateChanges,
        thirtyYearRateChanges,
        yieldCurveChanges,
        highYieldSpreadChanges,
        investmentGradeSpreadChanges,
      }),
    );
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

export async function buildTickerMarketPriceFactorFeaturesTimeline(
  input: BuildTickerMarketPriceFactorFeaturesTimelineInput,
): Promise<BuildTickerMarketPriceFactorFeaturesTimelineResult> {
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
  const vixByDate = await loadVixByDate(maxSnapshotDate);
  const tenYearRateChanges = await loadFredDailyChangesByDate({
    seriesId: "DGS10",
    asOfDate: maxSnapshotDate,
  });
  const twoYearRateChanges = await loadFredDailyChangesByDate({
    seriesId: "DGS2",
    asOfDate: maxSnapshotDate,
  });
  const fiveYearRateChanges = await loadFredDailyChangesByDate({
    seriesId: "DGS5",
    asOfDate: maxSnapshotDate,
  });
  const thirtyYearRateChanges = await loadFredDailyChangesByDate({
    seriesId: "DGS30",
    asOfDate: maxSnapshotDate,
  });
  const yieldCurveChanges = await loadFredDailyChangesByDate({
    seriesId: "T10Y2Y",
    asOfDate: maxSnapshotDate,
  });
  const highYieldSpreadChanges = await loadFredDailyChangesByDate({
    seriesId: "BAMLH0A0HYM2",
    asOfDate: maxSnapshotDate,
  });
  const investmentGradeSpreadChanges = await loadFredDailyChangesByDate({
    seriesId: "BAMLC0A0CM",
    asOfDate: maxSnapshotDate,
  });

  const contexts = snapshotDates.map((snapshotDate, snapshotIndex) => {
    input.onProgress?.({
      message: `[${snapshotIndex + 1}/${snapshotDates.length}] Preparing market price snapshot ${snapshotDate}.`,
      current: snapshotIndex + 1,
      total: snapshotDates.length,
      label: snapshotDate,
    });

    const pointsByTicker = slicePointsByTickerAtDate(allPointsByTicker, snapshotDate);
    const benchmarkReturnsByTicker = buildBenchmarkReturnsByTicker(pointsByTicker);
    const candidateEntries = Array.from(pointsByTicker.entries())
      .filter(([ticker]) => !isBenchmarkTicker(ticker))
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
        message: `Skipping stale market price feature inputs. referenceAsOf=${referenceAsOfDate}, maxStalenessDays=${MAX_PRICE_STALENESS_DAYS}, skipped=${staleTickers.length}.`,
        level: "warning",
        current: 0,
        total: staleTickers.length,
      });
    }

    return {
      snapshotDate,
      pointsByTicker,
      benchmarkReturnsByTicker,
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
      message: `[${index + 1}/${timelineTickers.length}] Building ${ticker} market price timeline.`,
      current: index + 1,
      total: timelineTickers.length,
      label: ticker,
    });

    const rows: FeatureRow[] = [];

    for (const context of contexts) {
      const points = context.entriesByTicker.get(ticker);
      if (!points) continue;

      rows.push(
        ...buildTickerFeatureRows({
          ticker,
          points,
          benchmarkPointsByTicker: context.pointsByTicker,
          benchmarkReturnsByTicker: context.benchmarkReturnsByTicker,
          vixByDate,
          twoYearRateChanges,
          fiveYearRateChanges,
          tenYearRateChanges,
          thirtyYearRateChanges,
          yieldCurveChanges,
          highYieldSpreadChanges,
          investmentGradeSpreadChanges,
        }),
      );
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
      ? [...new Set([...requestedTickers, ...BENCHMARK_TICKERS])]
      : [];
  const result = await db.query<PriceRow>(
    `
    SELECT ticker, price_date, close, volume
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
        volume: toNullableNumber(row.volume),
      },
    ]);
  }

  return new Map(
    Array.from(grouped.entries()).filter(
      ([, points]) => points.length >= ONE_YEAR_DAYS,
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
      if (sliced.length < ONE_YEAR_DAYS) return [];
      return [[ticker, sliced]];
    }),
  );
}

async function loadVixByDate(asOfDate?: string): Promise<Map<string, number>> {
  const result = await db.query<{
    observation_date: Date | string;
    value: number | string | null;
  }>(
    `
    SELECT observation_date, value
    FROM public.fred_macro_series_observations
    WHERE series_id = 'VIXCLS'
      AND units = 'lin'
      AND ($1::date IS NULL OR observation_date <= $1::date)
      AND value IS NOT NULL
    ORDER BY observation_date ASC
    `,
    [asOfDate ?? null],
  );

  return new Map(
    result.rows.flatMap((row) => {
      const value = toNullableNumber(row.value);
      if (value === null || !Number.isFinite(value)) return [];
      return [[toIsoDate(row.observation_date), value]];
    }),
  );
}

async function loadFredDailyChangesByDate(input: {
  seriesId: string;
  asOfDate?: string;
}): Promise<Map<string, number>> {
  const result = await db.query<{
    observation_date: Date | string;
    value: number | string | null;
  }>(
    `
    SELECT observation_date, value
    FROM public.fred_macro_series_observations
    WHERE series_id = $1
      AND units = 'lin'
      AND ($2::date IS NULL OR observation_date <= $2::date)
      AND value IS NOT NULL
    ORDER BY observation_date ASC
    `,
    [input.seriesId, input.asOfDate ?? null],
  );

  const changes = new Map<string, number>();
  let previousValue: number | null = null;

  for (const row of result.rows) {
    const value = toNullableNumber(row.value);
    if (value === null || !Number.isFinite(value)) continue;

    if (previousValue !== null) {
      changes.set(toIsoDate(row.observation_date), (value - previousValue) / 100);
    }
    previousValue = value;
  }

  return changes;
}

function buildTickerFeatureRows(input: {
  ticker: string;
  points: PricePoint[];
  benchmarkPointsByTicker: Map<string, PricePoint[]>;
  benchmarkReturnsByTicker: Map<string, DailyReturnPoint[]>;
  vixByDate: Map<string, number>;
  twoYearRateChanges: Map<string, number>;
  fiveYearRateChanges: Map<string, number>;
  tenYearRateChanges: Map<string, number>;
  thirtyYearRateChanges: Map<string, number>;
  yieldCurveChanges: Map<string, number>;
  highYieldSpreadChanges: Map<string, number>;
  investmentGradeSpreadChanges: Map<string, number>;
}): FeatureRow[] {
  const { ticker, points } = input;
  const latest = points.at(-1);
  if (!latest) return [];

  const spyPoints = input.benchmarkPointsByTicker.get("SPY") ?? [];
  const returns = buildDailyLogReturns(points);
  const oneYearReturns = returns.slice(-ONE_YEAR_DAYS);
  const threeYearReturns = returns.slice(-THREE_YEAR_DAYS);
  const spyPairs1Y = buildBenchmarkPairs({
    returns: oneYearReturns,
    benchmarkReturns: input.benchmarkReturnsByTicker.get("SPY") ?? [],
  });
  const spyPairs3Y = buildBenchmarkPairs({
    returns: threeYearReturns,
    benchmarkReturns: input.benchmarkReturnsByTicker.get("SPY") ?? [],
  });
  const qqqPairs1Y = buildBenchmarkPairs({
    returns: oneYearReturns,
    benchmarkReturns: input.benchmarkReturnsByTicker.get("QQQ") ?? [],
  });
  const qqqPairs3Y = buildBenchmarkPairs({
    returns: threeYearReturns,
    benchmarkReturns: input.benchmarkReturnsByTicker.get("QQQ") ?? [],
  });
  const diaPairs1Y = buildBenchmarkPairs({
    returns: oneYearReturns,
    benchmarkReturns: input.benchmarkReturnsByTicker.get("DIA") ?? [],
  });
  const diaPairs3Y = buildBenchmarkPairs({
    returns: threeYearReturns,
    benchmarkReturns: input.benchmarkReturnsByTicker.get("DIA") ?? [],
  });
  const shyPairs3Y = buildBenchmarkPairs({
    returns: threeYearReturns,
    benchmarkReturns: input.benchmarkReturnsByTicker.get("SHY") ?? [],
  });
  const iefPairs3Y = buildBenchmarkPairs({
    returns: threeYearReturns,
    benchmarkReturns: input.benchmarkReturnsByTicker.get("IEF") ?? [],
  });
  const tltPairs3Y = buildBenchmarkPairs({
    returns: threeYearReturns,
    benchmarkReturns: input.benchmarkReturnsByTicker.get("TLT") ?? [],
  });
  const rows: FeatureRow[] = [];

  addFeature(rows, ticker, "defensive", PRICE_METRIC_KEY, "downMarketDefense1Y", calcDownMarketDefense(spyPairs1Y), latest.date);
  addFeature(rows, ticker, "defensive", PRICE_METRIC_KEY, "downMarketDefense3Y", calcDownMarketDefense(spyPairs3Y), latest.date);
  addFeature(rows, ticker, "defensive", PRICE_METRIC_KEY, "volatilityStressDefense1Y", calcVolatilityStressDefense({
    returns: oneYearReturns,
    benchmarkReturns: input.benchmarkReturnsByTicker.get("SPY") ?? [],
    vixByDate: input.vixByDate,
  }), latest.date);
  addFeature(rows, ticker, "defensive", PRICE_METRIC_KEY, "volatilityStressDefense3Y", calcVolatilityStressDefense({
    returns: threeYearReturns,
    benchmarkReturns: input.benchmarkReturnsByTicker.get("SPY") ?? [],
    vixByDate: input.vixByDate,
  }), latest.date);
  addFeature(rows, ticker, "defensive", PRICE_METRIC_KEY, "drawdownDefense1Y", calcDrawdownDefense(points.slice(-ONE_YEAR_DAYS), spyPoints.slice(-ONE_YEAR_DAYS)), latest.date);
  addFeature(rows, ticker, "defensive", PRICE_METRIC_KEY, "downsideCaptureDefense1Y", calcDownsideCaptureDefense(spyPairs1Y), latest.date);

  addFeature(rows, ticker, "momentum", PRICE_METRIC_KEY, "priceReturn3M", calcPointReturn(points, THREE_MONTH_DAYS), latest.date);
  addFeature(rows, ticker, "momentum", PRICE_METRIC_KEY, "priceReturn6M", calcPointReturn(points, SIX_MONTH_DAYS), latest.date);
  addFeature(rows, ticker, "momentum", PRICE_METRIC_KEY, "priceReturn12M", calcPointReturn(points, ONE_YEAR_DAYS), latest.date);
  addFeature(rows, ticker, "momentum", PRICE_METRIC_KEY, "priceMomentum12MEx1M", calcSkipMonthMomentum(points), latest.date);
  addFeature(rows, ticker, "momentum", PRICE_METRIC_KEY, "relativeReturn3M", calcRelativePointReturn(points, spyPoints, THREE_MONTH_DAYS), latest.date);
  addFeature(rows, ticker, "momentum", PRICE_METRIC_KEY, "relativeReturn6M", calcRelativePointReturn(points, spyPoints, SIX_MONTH_DAYS), latest.date);
  addFeature(rows, ticker, "momentum", PRICE_METRIC_KEY, "relativeReturn12M", calcRelativePointReturn(points, spyPoints, ONE_YEAR_DAYS), latest.date);
  addFeature(rows, ticker, "momentum", PRICE_METRIC_KEY, "relativeMomentum12MEx1M", calcRelativeSkipMonthMomentum(points, spyPoints), latest.date);
  addFeature(rows, ticker, "momentum", PRICE_METRIC_KEY, "momentumConsistency12M", calcPositiveMonthlyReturnRatio(points), latest.date);
  addFeature(rows, ticker, "momentum", PRICE_METRIC_KEY, "distanceFrom52WeekHigh", calcDistanceFromRollingHigh(points, ONE_YEAR_DAYS), latest.date);

  addFeature(rows, ticker, "low_volatility", PRICE_METRIC_KEY, "realizedVolatility1Y", calcAnnualizedVolatility(oneYearReturns), latest.date);
  addFeature(rows, ticker, "low_volatility", PRICE_METRIC_KEY, "realizedVolatility3Y", calcAnnualizedVolatility(threeYearReturns), latest.date);
  addFeature(rows, ticker, "low_volatility", PRICE_METRIC_KEY, "downsideVolatility1Y", calcDownsideVolatility(oneYearReturns), latest.date);
  addFeature(rows, ticker, "low_volatility", PRICE_METRIC_KEY, "maxDrawdown1Y", calcMaxDrawdown(points.slice(-ONE_YEAR_DAYS)), latest.date);

  addFeature(rows, ticker, "high_beta", PRICE_METRIC_KEY, "marketBeta1Y", calcBeta(spyPairs1Y), latest.date);
  addFeature(rows, ticker, "high_beta", PRICE_METRIC_KEY, "marketBeta3Y", calcBeta(spyPairs3Y), latest.date);
  addFeature(rows, ticker, "high_beta", PRICE_METRIC_KEY, "correlationToMarket3Y", calcCorrelation(spyPairs3Y), latest.date);
  addFeature(rows, ticker, "high_beta", PRICE_METRIC_KEY, "upsideCapture1Y", calcCapture(spyPairs1Y, "upside"), latest.date);
  addFeature(rows, ticker, "high_beta", PRICE_METRIC_KEY, "downsideCapture1Y", calcCapture(spyPairs1Y, "downside"), latest.date);
  addFeature(rows, ticker, "high_beta", PRICE_METRIC_KEY, "qqqBeta1Y", calcBeta(qqqPairs1Y), latest.date);
  addFeature(rows, ticker, "high_beta", PRICE_METRIC_KEY, "qqqBeta3Y", calcBeta(qqqPairs3Y), latest.date);
  addFeature(rows, ticker, "high_beta", PRICE_METRIC_KEY, "qqqCorrelation3Y", calcCorrelation(qqqPairs3Y), latest.date);
  addFeature(rows, ticker, "high_beta", PRICE_METRIC_KEY, "diaBeta1Y", calcBeta(diaPairs1Y), latest.date);
  addFeature(rows, ticker, "high_beta", PRICE_METRIC_KEY, "diaBeta3Y", calcBeta(diaPairs3Y), latest.date);
  addFeature(rows, ticker, "high_beta", PRICE_METRIC_KEY, "diaCorrelation3Y", calcCorrelation(diaPairs3Y), latest.date);

  addFeature(rows, ticker, "rate_sensitive", PRICE_METRIC_KEY, "rateUpRelativeReturn1Y", calcMacroConditionRelativeReturn({
    returns: oneYearReturns,
    benchmarkReturns: input.benchmarkReturnsByTicker.get("SPY") ?? [],
    macroChangesByDate: input.tenYearRateChanges,
    predicate: (change) => change > 0,
    minObservations: 30,
  }), latest.date);
  addFeature(rows, ticker, "rate_sensitive", PRICE_METRIC_KEY, "rateUpRelativeReturn3Y", calcMacroConditionRelativeReturn({
    returns: threeYearReturns,
    benchmarkReturns: input.benchmarkReturnsByTicker.get("SPY") ?? [],
    macroChangesByDate: input.tenYearRateChanges,
    predicate: (change) => change > 0,
    minObservations: 90,
  }), latest.date);
  addFeature(rows, ticker, "rate_sensitive", PRICE_METRIC_KEY, "rateShockRelativeReturn1Y", calcMacroConditionRelativeReturn({
    returns: oneYearReturns,
    benchmarkReturns: input.benchmarkReturnsByTicker.get("SPY") ?? [],
    macroChangesByDate: input.tenYearRateChanges,
    predicate: (change) => change >= RATE_SHOCK_THRESHOLD,
    minObservations: 10,
  }), latest.date);
  addFeature(rows, ticker, "rate_sensitive", PRICE_METRIC_KEY, "rateBeta3Y", calcMacroBetaPer100Bp({
    returns: threeYearReturns,
    macroChangesByDate: input.tenYearRateChanges,
    minObservations: 90,
  }), latest.date);
  addFeature(rows, ticker, "rate_sensitive", PRICE_METRIC_KEY, "curveFlatteningRelativeReturn3Y", calcMacroConditionRelativeReturn({
    returns: threeYearReturns,
    benchmarkReturns: input.benchmarkReturnsByTicker.get("SPY") ?? [],
    macroChangesByDate: input.yieldCurveChanges,
    predicate: (change) => change < 0,
    minObservations: 90,
  }), latest.date);

  addFeature(rows, ticker, "credit_sensitive", PRICE_METRIC_KEY, "creditSpreadWideningRelativeReturn1Y", calcMacroConditionRelativeReturn({
    returns: oneYearReturns,
    benchmarkReturns: input.benchmarkReturnsByTicker.get("SPY") ?? [],
    macroChangesByDate: input.highYieldSpreadChanges,
    predicate: (change) => change > 0,
    minObservations: 30,
  }), latest.date);
  addFeature(rows, ticker, "credit_sensitive", PRICE_METRIC_KEY, "creditSpreadWideningRelativeReturn3Y", calcMacroConditionRelativeReturn({
    returns: threeYearReturns,
    benchmarkReturns: input.benchmarkReturnsByTicker.get("SPY") ?? [],
    macroChangesByDate: input.highYieldSpreadChanges,
    predicate: (change) => change > 0,
    minObservations: 90,
  }), latest.date);
  addFeature(rows, ticker, "credit_sensitive", PRICE_METRIC_KEY, "creditShockRelativeReturn1Y", calcMacroConditionRelativeReturn({
    returns: oneYearReturns,
    benchmarkReturns: input.benchmarkReturnsByTicker.get("SPY") ?? [],
    macroChangesByDate: input.highYieldSpreadChanges,
    predicate: (change) => change >= CREDIT_SHOCK_THRESHOLD,
    minObservations: 10,
  }), latest.date);
  addFeature(rows, ticker, "credit_sensitive", PRICE_METRIC_KEY, "highYieldSpreadBeta3Y", calcMacroBetaPer100Bp({
    returns: threeYearReturns,
    macroChangesByDate: input.highYieldSpreadChanges,
    minObservations: 90,
  }), latest.date);
  addFeature(rows, ticker, "credit_sensitive", PRICE_METRIC_KEY, "investmentGradeSpreadBeta3Y", calcMacroBetaPer100Bp({
    returns: threeYearReturns,
    macroChangesByDate: input.investmentGradeSpreadChanges,
    minObservations: 90,
  }), latest.date);

  addFeature(rows, ticker, "duration_sensitive", PRICE_METRIC_KEY, "shortRateBeta3Y", calcMacroBetaPer100Bp({
    returns: threeYearReturns,
    macroChangesByDate: input.twoYearRateChanges,
    minObservations: 90,
  }), latest.date);
  addFeature(rows, ticker, "duration_sensitive", PRICE_METRIC_KEY, "intermediateRateBeta3Y", calcMacroBetaPer100Bp({
    returns: threeYearReturns,
    macroChangesByDate: input.fiveYearRateChanges,
    minObservations: 90,
  }), latest.date);
  addFeature(rows, ticker, "duration_sensitive", PRICE_METRIC_KEY, "ultraLongRateBeta3Y", calcMacroBetaPer100Bp({
    returns: threeYearReturns,
    macroChangesByDate: input.thirtyYearRateChanges,
    minObservations: 90,
  }), latest.date);
  addFeature(rows, ticker, "duration_sensitive", PRICE_METRIC_KEY, "yieldCurveBeta3Y", calcMacroBetaPer100Bp({
    returns: threeYearReturns,
    macroChangesByDate: input.yieldCurveChanges,
    minObservations: 90,
  }), latest.date);
  addFeature(rows, ticker, "duration_sensitive", PRICE_METRIC_KEY, "shortTreasuryBeta3Y", calcBeta(shyPairs3Y), latest.date);
  addFeature(rows, ticker, "duration_sensitive", PRICE_METRIC_KEY, "intermediateTreasuryBeta3Y", calcBeta(iefPairs3Y), latest.date);
  addFeature(rows, ticker, "duration_sensitive", PRICE_METRIC_KEY, "longBondBeta3Y", calcBeta(tltPairs3Y), latest.date);

  return rows;
}

function addFeature(
  rows: FeatureRow[],
  ticker: string,
  factor: FactorKey,
  metricKey: string,
  featureKey: string,
  featureValue: number | null,
  periodEnd: string,
) {
  if (featureValue === null || !Number.isFinite(featureValue)) return;

  rows.push({
    ticker,
    factor,
    axis: MARKET_PRICE_AXIS,
    metricKey: MARKET_PRICE_FEATURE_METRIC_KEYS[featureKey] ?? metricKey,
    featureKey,
    featureValue,
    periodEnd,
    effectiveDate: periodEnd,
  });
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

function buildBenchmarkReturnsByTicker(
  pointsByTicker: Map<string, PricePoint[]>,
): Map<string, DailyReturnPoint[]> {
  return new Map(
    BENCHMARK_TICKERS.map((ticker) => [
      ticker,
      buildDailyLogReturns(pointsByTicker.get(ticker) ?? []),
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
    if (benchmark === undefined) return [];

    return Number.isFinite(benchmark)
      ? [{ stock: point.value, benchmark }]
      : [];
  });
}

function calcPointReturn(points: PricePoint[], lookbackDays: number): number | null {
  const latest = points.at(-1);
  const prior = points.at(-(lookbackDays + 1));
  if (!latest || !prior || prior.close <= 0) return null;
  return latest.close / prior.close - 1;
}

function calcRelativePointReturn(
  points: PricePoint[],
  benchmarkPoints: PricePoint[],
  lookbackDays: number,
): number | null {
  const stockReturn = calcPointReturn(points, lookbackDays);
  const benchmarkReturn = calcPointReturn(benchmarkPoints, lookbackDays);
  if (stockReturn === null || benchmarkReturn === null) return null;
  return stockReturn - benchmarkReturn;
}

function calcSkipMonthMomentum(points: PricePoint[]): number | null {
  const recentSkip = points.at(-(ONE_MONTH_DAYS + 1));
  const prior = points.at(-(ONE_YEAR_DAYS + 1));
  if (!recentSkip || !prior || prior.close <= 0) return null;
  return recentSkip.close / prior.close - 1;
}

function calcRelativeSkipMonthMomentum(
  points: PricePoint[],
  benchmarkPoints: PricePoint[],
): number | null {
  const stockMomentum = calcSkipMonthMomentum(points);
  const benchmarkMomentum = calcSkipMonthMomentum(benchmarkPoints);
  if (stockMomentum === null || benchmarkMomentum === null) return null;
  return stockMomentum - benchmarkMomentum;
}

function calcDownMarketDefense(
  pairs: Array<{ stock: number; benchmark: number }>,
): number | null {
  const downsidePairs = pairs.filter((pair) => pair.benchmark < 0);
  if (downsidePairs.length < 30) return null;

  const stockSum = downsidePairs.reduce((sum, pair) => sum + pair.stock, 0);
  const benchmarkSum = downsidePairs.reduce(
    (sum, pair) => sum + pair.benchmark,
    0,
  );

  return stockSum - benchmarkSum;
}

function calcDownsideCaptureDefense(
  pairs: Array<{ stock: number; benchmark: number }>,
): number | null {
  const downsideCapture = calcCapture(pairs, "downside");
  return downsideCapture === null ? null : 1 - downsideCapture;
}

function calcVolatilityStressDefense(input: {
  returns: DailyReturnPoint[];
  benchmarkReturns: DailyReturnPoint[];
  vixByDate: Map<string, number>;
}): number | null {
  if (input.vixByDate.size === 0) return null;

  const benchmarkReturnsByDate = new Map(
    input.benchmarkReturns.map((point) => [point.date, point.value]),
  );
  const stressPairs = input.returns.flatMap((point) => {
    const vix = input.vixByDate.get(point.date);
    const benchmark = benchmarkReturnsByDate.get(point.date);
    if (vix === undefined || benchmark === undefined) return [];
    if (vix < VIX_STRESS_THRESHOLD) return [];
    return [{ stock: point.value, benchmark }];
  });

  if (stressPairs.length < 10) return null;

  const stockSum = stressPairs.reduce((sum, pair) => sum + pair.stock, 0);
  const benchmarkSum = stressPairs.reduce(
    (sum, pair) => sum + pair.benchmark,
    0,
  );

  return stockSum - benchmarkSum;
}

function calcMacroConditionRelativeReturn(input: {
  returns: DailyReturnPoint[];
  benchmarkReturns: DailyReturnPoint[];
  macroChangesByDate: Map<string, number>;
  predicate: (change: number) => boolean;
  minObservations: number;
}): number | null {
  if (input.macroChangesByDate.size === 0) return null;

  const benchmarkReturnsByDate = new Map(
    input.benchmarkReturns.map((point) => [point.date, point.value]),
  );
  const pairs = input.returns.flatMap((point) => {
    const macroChange = input.macroChangesByDate.get(point.date);
    const benchmark = benchmarkReturnsByDate.get(point.date);
    if (macroChange === undefined || benchmark === undefined) return [];
    if (!input.predicate(macroChange)) return [];
    return [{ stock: point.value, benchmark }];
  });

  if (pairs.length < input.minObservations) return null;

  const stockSum = pairs.reduce((sum, pair) => sum + pair.stock, 0);
  const benchmarkSum = pairs.reduce((sum, pair) => sum + pair.benchmark, 0);
  return stockSum - benchmarkSum;
}

function calcMacroBeta(input: {
  returns: DailyReturnPoint[];
  macroChangesByDate: Map<string, number>;
  minObservations: number;
}): number | null {
  const pairs = input.returns.flatMap((point) => {
    const macroChange = input.macroChangesByDate.get(point.date);
    if (macroChange === undefined || !Number.isFinite(macroChange)) return [];
    return [{ stock: point.value, macro: macroChange }];
  });

  if (pairs.length < input.minObservations) return null;

  const macroValues = pairs.map((pair) => pair.macro);
  const variance = sampleVariance(macroValues);
  if (variance === null || variance === 0) return null;

  return covariance(
    pairs.map((pair) => pair.stock),
    macroValues,
  ) / variance;
}

function calcMacroBetaPer100Bp(input: {
  returns: DailyReturnPoint[];
  macroChangesByDate: Map<string, number>;
  minObservations: number;
}): number | null {
  const betaPerUnitChange = calcMacroBeta(input);
  return betaPerUnitChange === null ? null : betaPerUnitChange * 0.01;
}

function calcDrawdownDefense(
  points: PricePoint[],
  benchmarkPoints: PricePoint[],
): number | null {
  const stockDrawdown = calcMaxDrawdown(points);
  const benchmarkDrawdown = calcMaxDrawdown(benchmarkPoints);
  if (stockDrawdown === null || benchmarkDrawdown === null) return null;
  return stockDrawdown - benchmarkDrawdown;
}

function calcPositiveMonthlyReturnRatio(points: PricePoint[]): number | null {
  if (points.length < ONE_YEAR_DAYS + 1) return null;

  let observed = 0;
  let positive = 0;

  for (let offset = ONE_MONTH_DAYS; offset <= ONE_YEAR_DAYS; offset += ONE_MONTH_DAYS) {
    const current = points.at(-(offset - ONE_MONTH_DAYS + 1));
    const prior = points.at(-(offset + 1));
    if (!current || !prior || prior.close <= 0) continue;

    observed += 1;
    if (current.close / prior.close - 1 > 0) positive += 1;
  }

  return observed > 0 ? positive / observed : null;
}

function calcDistanceFromRollingHigh(
  points: PricePoint[],
  lookbackDays: number,
): number | null {
  const window = points.slice(-lookbackDays);
  const latest = points.at(-1);
  if (!latest || window.length === 0) return null;

  const high = Math.max(...window.map((point) => point.close));
  return high > 0 ? latest.close / high - 1 : null;
}

function calcAnnualizedVolatility(returns: DailyReturnPoint[]): number | null {
  if (returns.length < 30) return null;
  return standardDeviation(returns.map((point) => point.value)) * Math.sqrt(TRADING_DAYS_PER_YEAR);
}

function calcDownsideVolatility(returns: DailyReturnPoint[]): number | null {
  const downsideReturns = returns.filter((point) => point.value < 0);
  if (downsideReturns.length < 10) return null;
  return standardDeviation(downsideReturns.map((point) => point.value)) * Math.sqrt(TRADING_DAYS_PER_YEAR);
}

function calcMaxDrawdown(points: PricePoint[]): number | null {
  if (points.length < 30) return null;

  let peak = points[0]?.close ?? 0;
  let maxDrawdown = 0;

  for (const point of points) {
    peak = Math.max(peak, point.close);
    if (peak <= 0) continue;
    maxDrawdown = Math.min(maxDrawdown, point.close / peak - 1);
  }

  return maxDrawdown;
}

function calcBeta(pairs: Array<{ stock: number; benchmark: number }>): number | null {
  if (pairs.length < 30) return null;

  const benchmarkValues = pairs.map((pair) => pair.benchmark);
  const variance = sampleVariance(benchmarkValues);
  if (variance === null || variance === 0) return null;

  return covariance(
    pairs.map((pair) => pair.stock),
    benchmarkValues,
  ) / variance;
}

function calcCorrelation(
  pairs: Array<{ stock: number; benchmark: number }>,
): number | null {
  if (pairs.length < 30) return null;

  const stockValues = pairs.map((pair) => pair.stock);
  const benchmarkValues = pairs.map((pair) => pair.benchmark);
  const stockStd = standardDeviation(stockValues);
  const benchmarkStd = standardDeviation(benchmarkValues);
  if (stockStd === 0 || benchmarkStd === 0) return null;

  return covariance(stockValues, benchmarkValues) / (stockStd * benchmarkStd);
}

function calcCapture(
  pairs: Array<{ stock: number; benchmark: number }>,
  direction: "upside" | "downside",
): number | null {
  const directionalPairs = pairs.filter((pair) =>
    direction === "upside" ? pair.benchmark > 0 : pair.benchmark < 0,
  );
  if (directionalPairs.length < 10) return null;

  const stockSum = directionalPairs.reduce((sum, pair) => sum + pair.stock, 0);
  const benchmarkSum = directionalPairs.reduce(
    (sum, pair) => sum + pair.benchmark,
    0,
  );

  return benchmarkSum !== 0 ? stockSum / benchmarkSum : null;
}

function standardDeviation(values: number[]): number {
  const variance = sampleVariance(values);
  return variance === null ? 0 : Math.sqrt(variance);
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
  const leftMean = left.slice(0, length).reduce((sum, value) => sum + value, 0) / length;
  const rightMean = right.slice(0, length).reduce((sum, value) => sum + value, 0) / length;
  let sum = 0;

  for (let index = 0; index < length; index += 1) {
    sum += ((left[index] ?? 0) - leftMean) * ((right[index] ?? 0) - rightMean);
  }

  return sum / (length - 1);
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
      MARKET_PRICE_AXIS,
      [...MARKET_PRICE_FACTORS],
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
      MARKET_PRICE_AXIS,
      [...MARKET_PRICE_FACTORS],
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

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

function isBenchmarkTicker(ticker: string): boolean {
  return (BENCHMARK_TICKERS as readonly string[]).includes(normalizeTicker(ticker));
}

function toNullableNumber(value: number | string | null): number | null {
  if (value === null) return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIsoDate(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return new Date(value).toISOString().slice(0, 10);
}

function getLatestDate(points: PricePoint[]): string | null {
  return points.reduce<string | null>(
    (latest, point) => (!latest || point.date > latest ? point.date : latest),
    null,
  );
}
