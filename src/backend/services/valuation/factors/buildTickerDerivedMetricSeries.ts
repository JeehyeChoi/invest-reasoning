import { db } from "@/backend/config/db";

export type BuildTickerDerivedMetricSeriesInput = {
  tickers?: string[];
  tickerCikMap?: Record<string, string | null>;
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

export type BuildTickerDerivedMetricSeriesResult = {
  tickerCount: number;
  derivedRowCount: number;
  asOfDate: string | null;
};

export type BuildTickerDerivedMetricSeriesTimelineInput =
  Omit<BuildTickerDerivedMetricSeriesInput, "asOfDate"> & {
    snapshotDates: string[];
  };

export type BuildTickerDerivedMetricSeriesTimelineResult =
  BuildTickerDerivedMetricSeriesResult & {
    snapshotDates: string[];
    completedRuns: number;
  };

type LatestPriceRow = {
  ticker: string;
  price_date: Date | string;
  close: number | string;
};

type SecMetricRow = {
  cik: string;
  ticker: string | null;
  metric_key: string;
  val: number | string | null;
  ttm_val: number | string | null;
  ttm_yoy: number | string | null;
  end: Date | string;
  effective_date: Date | string;
  period_type: "quarter" | "instant";
};

type ValuationMetricRow = {
  ticker: string;
  cik: string | null;
  axis: "valuation";
  processKey: string;
  sourceKind: "valuation_composite";
  derivedMetricKey: string;
  value: number;
  valueType: "ratio" | "value";
  benchmarkKey: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  periodEnd: string;
  effectiveDate: string;
  sourcePayload: Record<string, unknown>;
};

const DEFAULT_PROVIDER = "twelve_data";
const DEFAULT_ADJUSTMENT_POLICY = "splits";
const SOURCE_TABLE =
  "ticker_daily_prices+sec_companyfact_metric_series_enriched";
const DERIVED_SOURCE_VERSION = "derived_metric_series_v0";
const SEC_METRIC_KEYS = [
  "eps_basic",
  "eps_diluted",
  "stockholders_equity",
  "revenue",
  "net_income",
  "operating_cash_flow",
  "capex_cash",
  "capex_incurred",
  "short_term_debt",
  "long_term_debt",
  "total_debt",
  "cash_and_cash_equivalents",
  "cash_and_short_term_investments",
  "dividends_per_share",
  "dividend_payments",
  "share_repurchases",
  "shares_outstanding",
] as const;

type TimelineTickerEntry = {
  ticker: string;
  cik: string;
};

export async function buildTickerDerivedMetricSeries(
  input: BuildTickerDerivedMetricSeriesInput = {},
): Promise<BuildTickerDerivedMetricSeriesResult> {
  const provider = input.provider ?? DEFAULT_PROVIDER;
  const adjustmentPolicy = input.adjustmentPolicy ?? DEFAULT_ADJUSTMENT_POLICY;
  const tickers = input.tickers?.map(normalizeTicker).filter(Boolean) ?? [];
  const pricesByTicker = await loadLatestPrices({
    tickers,
    provider,
    adjustmentPolicy,
    asOfDate: input.asOfDate,
  });
  const tickerCikMap = input.tickerCikMap ?? {};
  const ciksByTicker = new Map<string, string>();

  for (const ticker of pricesByTicker.keys()) {
    const cik = tickerCikMap[ticker] ?? null;
    if (cik) ciksByTicker.set(ticker, cik);
  }

  const secRowsByCik = await loadLatestSecMetricRows({
    ciks: [...new Set(ciksByTicker.values())],
    asOfDate:
      input.asOfDate ?? getLatestPriceDate(Array.from(pricesByTicker.values())) ?? undefined,
  });
  const entries = Array.from(pricesByTicker.entries()).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const derivedRows: ValuationMetricRow[] = [];

  for (const [index, [ticker, priceRow]] of entries.entries()) {
    input.onProgress?.({
      message: `[${index + 1}/${entries.length}] Valuation metrics enriching ${ticker}.`,
      current: index + 1,
      total: entries.length,
      label: ticker,
    });

    const cik = ciksByTicker.get(ticker) ?? null;
    if (!cik) continue;

    derivedRows.push(
      ...buildTickerEnrichedRows({
        ticker,
        cik,
        priceRow,
        secRows: secRowsByCik.get(cik) ?? [],
      }),
    );
  }

  const targetTickers = entries.map(([ticker]) => ticker);
  await deleteExistingDerivedRows({
    tickers: targetTickers,
    effectiveDates: getDistinctEffectiveDates(derivedRows),
  });
  await upsertDerivedRows(derivedRows);

  return {
    tickerCount: entries.length,
    derivedRowCount: derivedRows.length,
    asOfDate: getLatestPriceDate(entries.map(([, row]) => row)),
  };
}

export async function buildTickerDerivedMetricSeriesTimeline(
  input: BuildTickerDerivedMetricSeriesTimelineInput,
): Promise<BuildTickerDerivedMetricSeriesTimelineResult> {
  const snapshotDates = Array.from(new Set(input.snapshotDates)).sort();
  if (snapshotDates.length === 0) {
    return {
      tickerCount: 0,
      derivedRowCount: 0,
      asOfDate: null,
      snapshotDates,
      completedRuns: 0,
    };
  }

  const provider = input.provider ?? DEFAULT_PROVIDER;
  const adjustmentPolicy = input.adjustmentPolicy ?? DEFAULT_ADJUSTMENT_POLICY;
  const tickers = input.tickers?.map(normalizeTicker).filter(Boolean) ?? [];
  const maxSnapshotDate = snapshotDates.at(-1);
  const entries = await resolveTimelineTickerEntries({
    tickers,
    provider,
    adjustmentPolicy,
    tickerCikMap: input.tickerCikMap ?? {},
    asOfDate: maxSnapshotDate,
  });
  let derivedRowCount = 0;
  let latestAsOfDate: string | null = null;

  for (const [index, entry] of entries.entries()) {
    input.onProgress?.({
      message: `[${index + 1}/${entries.length}] Valuation metrics enriching ${entry.ticker} timeline.`,
      current: index + 1,
      total: entries.length,
      label: entry.ticker,
    });

    const priceRows = await loadPriceRowsForTicker({
      ticker: entry.ticker,
      provider,
      adjustmentPolicy,
      asOfDate: maxSnapshotDate,
    });
    if (priceRows.length === 0) continue;

    const cikSecRows = await loadSecMetricRowsForCik({
      cik: entry.cik,
      asOfDate: maxSnapshotDate,
    });
    const rows: ValuationMetricRow[] = [];

    for (const snapshotDate of snapshotDates) {
      const priceRow = findLatestPriceRow(priceRows, snapshotDate);
      if (!priceRow) continue;

      rows.push(
        ...buildTickerEnrichedRows({
          ticker: entry.ticker,
          cik: entry.cik,
          priceRow,
          secRows: pickLatestSecMetricRows(cikSecRows, snapshotDate),
        }),
      );
      latestAsOfDate = maxIsoDate([latestAsOfDate, toIsoDate(priceRow.price_date)]);
    }

    const dedupedRows = dedupeDerivedRows(rows);
    await deleteExistingDerivedRows({
      tickers: [entry.ticker],
      effectiveDates: getDistinctEffectiveDates(dedupedRows),
    });
    await upsertDerivedRows(dedupedRows);
    derivedRowCount += dedupedRows.length;
  }

  return {
    tickerCount: entries.length,
    derivedRowCount,
    asOfDate: latestAsOfDate,
    snapshotDates,
    completedRuns: snapshotDates.length,
  };
}

async function resolveTimelineTickerEntries(input: {
  tickers: string[];
  provider: string;
  adjustmentPolicy: string;
  tickerCikMap: Record<string, string | null>;
  asOfDate?: string;
}): Promise<TimelineTickerEntry[]> {
  const tickers =
    input.tickers.length > 0
      ? input.tickers
      : await loadPriceTickers({
          provider: input.provider,
          adjustmentPolicy: input.adjustmentPolicy,
          asOfDate: input.asOfDate,
        });

  return tickers
    .map((ticker) => ({
      ticker: normalizeTicker(ticker),
      cik: input.tickerCikMap[normalizeTicker(ticker)] ?? null,
    }))
    .filter((entry): entry is TimelineTickerEntry => Boolean(entry.cik))
    .sort((a, b) => a.ticker.localeCompare(b.ticker));
}

async function loadPriceTickers(input: {
  provider: string;
  adjustmentPolicy: string;
  asOfDate?: string;
}): Promise<string[]> {
  const result = await db.query<{ ticker: string }>(
    `
    SELECT DISTINCT ticker
    FROM public.ticker_daily_prices
    WHERE provider = $1
      AND adjustment_policy = $2
      AND ($3::date IS NULL OR price_date <= $3::date)
    ORDER BY ticker ASC
    `,
    [input.provider, input.adjustmentPolicy, input.asOfDate ?? null],
  );

  return result.rows.map((row) => normalizeTicker(row.ticker));
}

async function loadLatestPrices(input: {
  tickers: string[];
  provider: string;
  adjustmentPolicy: string;
  asOfDate?: string;
}): Promise<Map<string, LatestPriceRow>> {
  const result = await db.query<LatestPriceRow>(
    `
    SELECT DISTINCT ON (ticker)
      ticker,
      price_date,
      close
    FROM public.ticker_daily_prices
    WHERE provider = $1
      AND adjustment_policy = $2
      AND ($3::date IS NULL OR price_date <= $3::date)
      AND ($4::text[] IS NULL OR ticker = ANY($4::text[]))
    ORDER BY ticker ASC, price_date DESC
    `,
    [
      input.provider,
      input.adjustmentPolicy,
      input.asOfDate ?? null,
      input.tickers.length > 0 ? input.tickers : null,
    ],
  );

  return new Map(
    result.rows
      .filter((row) => {
        const close = Number(row.close);
        return Number.isFinite(close) && close > 0;
      })
      .map((row) => [normalizeTicker(row.ticker), row]),
  );
}

async function loadPriceRowsForTicker(input: {
  ticker: string;
  provider: string;
  adjustmentPolicy: string;
  asOfDate?: string;
}): Promise<LatestPriceRow[]> {
  const result = await db.query<LatestPriceRow>(
    `
    SELECT ticker, price_date, close
    FROM public.ticker_daily_prices
    WHERE provider = $1
      AND adjustment_policy = $2
      AND ($3::date IS NULL OR price_date <= $3::date)
      AND ticker = $4
    ORDER BY price_date ASC
    `,
    [
      input.provider,
      input.adjustmentPolicy,
      input.asOfDate ?? null,
      input.ticker,
    ],
  );

  return result.rows.filter((row) => {
    const close = Number(row.close);
    return Number.isFinite(close) && close > 0;
  });
}

function findLatestPriceRow(
  rows: LatestPriceRow[],
  asOfDate: string,
): LatestPriceRow | null {
  let latest: LatestPriceRow | null = null;

  for (const row of rows) {
    const priceDate = toIsoDate(row.price_date);
    if (priceDate > asOfDate) break;
    latest = row;
  }

  return latest;
}

async function loadLatestSecMetricRows(input: {
  ciks: string[];
  asOfDate?: string;
}): Promise<Map<string, SecMetricRow[]>> {
  if (input.ciks.length === 0) return new Map();

  const result = await db.query<SecMetricRow>(
    `
    SELECT DISTINCT ON (cik, metric_key, period_type)
      cik,
      ticker,
      metric_key,
      val,
      ttm_val,
      ttm_yoy,
      "end",
      effective_date,
      period_type
    FROM public.sec_companyfact_metric_series_enriched
    WHERE cik = ANY($1::text[])
      AND metric_key = ANY($2::text[])
      AND period_type IN ('quarter', 'instant')
      AND ($3::date IS NULL OR effective_date <= $3::date)
    ORDER BY cik ASC, metric_key ASC, period_type ASC, effective_date DESC, "end" DESC
    `,
    [input.ciks, [...SEC_METRIC_KEYS], input.asOfDate ?? null],
  );

  const grouped = new Map<string, SecMetricRow[]>();

  for (const row of result.rows) {
    grouped.set(row.cik, [...(grouped.get(row.cik) ?? []), row]);
  }

  return grouped;
}

async function loadSecMetricRowsForCik(input: {
  cik: string;
  asOfDate?: string;
}): Promise<SecMetricRow[]> {
  const result = await db.query<SecMetricRow>(
    `
    SELECT
      cik,
      ticker,
      metric_key,
      val,
      ttm_val,
      ttm_yoy,
      "end",
      effective_date,
      period_type
    FROM public.sec_companyfact_metric_series_enriched
    WHERE cik = $1
      AND metric_key = ANY($2::text[])
      AND period_type IN ('quarter', 'instant')
      AND ($3::date IS NULL OR effective_date <= $3::date)
    ORDER BY metric_key ASC, period_type ASC, effective_date ASC, "end" ASC
    `,
    [input.cik, [...SEC_METRIC_KEYS], input.asOfDate ?? null],
  );

  return result.rows;
}

function pickLatestSecMetricRows(
  rows: SecMetricRow[],
  asOfDate: string,
): SecMetricRow[] {
  const latestByKey = new Map<string, SecMetricRow>();

  for (const row of rows) {
    const effectiveDate = toIsoDate(row.effective_date);
    if (effectiveDate > asOfDate) continue;

    const key = buildSecMetricIndexKey(row.metric_key, row.period_type);
    const current = latestByKey.get(key);
    if (
      !current ||
      effectiveDate > toIsoDate(current.effective_date) ||
      (effectiveDate === toIsoDate(current.effective_date) &&
        toIsoDate(row.end) > toIsoDate(current.end))
    ) {
      latestByKey.set(key, row);
    }
  }

  return Array.from(latestByKey.values());
}

function buildTickerEnrichedRows(input: {
  ticker: string;
  cik: string;
  priceRow: LatestPriceRow;
  secRows: SecMetricRow[];
}): ValuationMetricRow[] {
  const close = Number(input.priceRow.close);
  if (!Number.isFinite(close) || close <= 0) return [];

  const sec = buildSecMetricIndex(input.secRows);
  const priceDate = toIsoDate(input.priceRow.price_date);
  const shares = metricNumber(sec, "shares_outstanding", "instant", "val");
  const sharesEffectiveDate = metricEffectiveDate(sec, "shares_outstanding", "instant");
  const marketCapEffectiveDate =
    maxIsoDate([priceDate, sharesEffectiveDate]) ?? priceDate;
  const marketCap =
    shares !== null && shares > 0 ? addNumber(close * shares) : null;
  const operatingCashFlow = metricNumber(
    sec,
    "operating_cash_flow",
    "quarter",
    "ttm_val",
  );
  const capex = firstNonNull([
    metricNumber(sec, "capex_cash", "quarter", "ttm_val"),
    metricNumber(sec, "capex_incurred", "quarter", "ttm_val"),
  ]);
  const freeCashFlow =
    operatingCashFlow !== null && capex !== null
      ? addNumber(operatingCashFlow - capex)
      : null;
  const shortTermDebt = metricNumber(sec, "short_term_debt", "instant", "val");
  const longTermDebt = metricNumber(sec, "long_term_debt", "instant", "val");
  const directTotalDebt = metricNumber(sec, "total_debt", "instant", "val");
  const combinedDebt =
    shortTermDebt !== null && longTermDebt !== null
      ? addNumber(shortTermDebt + longTermDebt)
      : null;
  const partialDebt = sumNullable(shortTermDebt, longTermDebt);
  const totalDebt = firstNonNull([
    combinedDebt,
    directTotalDebt,
    partialDebt,
  ]);
  const debtMetricKey =
    combinedDebt !== null
      ? "short_term_debt + long_term_debt"
      : directTotalDebt !== null
        ? "total_debt"
        : shortTermDebt !== null
          ? "short_term_debt"
          : longTermDebt !== null
            ? "long_term_debt"
            : null;
  const cash = firstNonNull([
    metricNumber(sec, "cash_and_short_term_investments", "instant", "val"),
    metricNumber(sec, "cash_and_cash_equivalents", "instant", "val"),
  ]);
  const enterpriseValue =
    marketCap !== null
      ? addNumber(marketCap + (totalDebt ?? 0) - (cash ?? 0))
      : null;
  const rows: ValuationMetricRow[] = [];

  addEnrichedRow(rows, {
    ticker: input.ticker,
    cik: input.cik,
    metricKey: "market_capitalization",
    metricValue: marketCap,
    periodEnd: metricPeriodEnd(sec, "shares_outstanding", "instant") ?? priceDate,
    effectiveDate: marketCapEffectiveDate,
    sourcePayload: {
      formula: "price.close * shares_outstanding.val",
      priceDate,
      sharesPeriodEnd: metricPeriodEnd(sec, "shares_outstanding", "instant"),
      sharesEffectiveDate,
    },
  });

  addEnrichedRow(rows, {
    ticker: input.ticker,
    cik: input.cik,
    metricKey: "log_market_capitalization",
    metricValue: marketCap !== null && marketCap > 0 ? Math.log(marketCap) : null,
    periodEnd: metricPeriodEnd(sec, "shares_outstanding", "instant") ?? priceDate,
    effectiveDate: marketCapEffectiveDate,
    sourcePayload: {
      formula: "log(price.close * shares_outstanding.val)",
      priceDate,
      sharesPeriodEnd: metricPeriodEnd(sec, "shares_outstanding", "instant"),
      sharesEffectiveDate,
    },
  });

  const dilutedEpsEffectiveDate = metricEffectiveDate(sec, "eps_diluted", "quarter");
  addPricePerShareRatio(rows, {
    ticker: input.ticker,
    cik: input.cik,
    close,
    denominator: metricNumber(sec, "eps_diluted", "quarter", "ttm_val"),
    metricKey: "price_to_diluted_ttm_eps",
    periodEnd: metricPeriodEnd(sec, "eps_diluted", "quarter") ?? priceDate,
    effectiveDate: maxIsoDate([priceDate, dilutedEpsEffectiveDate]) ?? priceDate,
    formula: "price.close / eps_diluted.ttm_val",
  });
  const basicEpsEffectiveDate = metricEffectiveDate(sec, "eps_basic", "quarter");
  addPricePerShareRatio(rows, {
    ticker: input.ticker,
    cik: input.cik,
    close,
    denominator: metricNumber(sec, "eps_basic", "quarter", "ttm_val"),
    metricKey: "price_to_basic_ttm_eps",
    periodEnd: metricPeriodEnd(sec, "eps_basic", "quarter") ?? priceDate,
    effectiveDate: maxIsoDate([priceDate, basicEpsEffectiveDate]) ?? priceDate,
    formula: "price.close / eps_basic.ttm_val",
  });

  addDirectSecMetric(rows, {
    ticker: input.ticker,
    cik: input.cik,
    metricKey: "diluted_ttm_eps_growth",
    metricValue: metricNumber(sec, "eps_diluted", "quarter", "ttm_yoy"),
    periodEnd: metricPeriodEnd(sec, "eps_diluted", "quarter") ?? priceDate,
    effectiveDate: dilutedEpsEffectiveDate ?? priceDate,
    formula: "eps_diluted.ttm_yoy",
  });
  addDirectSecMetric(rows, {
    ticker: input.ticker,
    cik: input.cik,
    metricKey: "basic_ttm_eps_growth",
    metricValue: metricNumber(sec, "eps_basic", "quarter", "ttm_yoy"),
    periodEnd: metricPeriodEnd(sec, "eps_basic", "quarter") ?? priceDate,
    effectiveDate: basicEpsEffectiveDate ?? priceDate,
    formula: "eps_basic.ttm_yoy",
  });

  const equityEffectiveDate = metricEffectiveDate(sec, "stockholders_equity", "instant");
  addMarketCapRatio(rows, {
    ticker: input.ticker,
    cik: input.cik,
    marketCap,
    denominator: metricNumber(sec, "stockholders_equity", "instant", "val"),
    metricKey: "price_to_book",
    periodEnd: metricPeriodEnd(sec, "stockholders_equity", "instant") ?? priceDate,
    effectiveDate:
      maxIsoDate([marketCapEffectiveDate, equityEffectiveDate]) ?? priceDate,
    formula: "market_cap / stockholders_equity.val",
  });
  const revenueEffectiveDate = metricEffectiveDate(sec, "revenue", "quarter");
  addMarketCapRatio(rows, {
    ticker: input.ticker,
    cik: input.cik,
    marketCap,
    denominator: metricNumber(sec, "revenue", "quarter", "ttm_val"),
    metricKey: "price_to_sales",
    periodEnd: metricPeriodEnd(sec, "revenue", "quarter") ?? priceDate,
    effectiveDate:
      maxIsoDate([marketCapEffectiveDate, revenueEffectiveDate]) ?? priceDate,
    formula: "market_cap / revenue.ttm_val",
  });
  const netIncomeEffectiveDate = metricEffectiveDate(sec, "net_income", "quarter");
  addMarketCapRatio(rows, {
    ticker: input.ticker,
    cik: input.cik,
    marketCap,
    denominator: metricNumber(sec, "net_income", "quarter", "ttm_val"),
    metricKey: "price_to_earnings",
    periodEnd: metricPeriodEnd(sec, "net_income", "quarter") ?? priceDate,
    effectiveDate:
      maxIsoDate([marketCapEffectiveDate, netIncomeEffectiveDate]) ?? priceDate,
    formula: "market_cap / net_income.ttm_val",
  });
  const operatingCashFlowEffectiveDate = metricEffectiveDate(
    sec,
    "operating_cash_flow",
    "quarter",
  );
  addMarketCapRatio(rows, {
    ticker: input.ticker,
    cik: input.cik,
    marketCap,
    denominator: operatingCashFlow,
    metricKey: "price_to_operating_cash_flow",
    periodEnd: metricPeriodEnd(sec, "operating_cash_flow", "quarter") ?? priceDate,
    effectiveDate:
      maxIsoDate([marketCapEffectiveDate, operatingCashFlowEffectiveDate]) ??
      priceDate,
    formula: "market_cap / operating_cash_flow.ttm_val",
  });

  addEnrichedRow(rows, {
    ticker: input.ticker,
    cik: input.cik,
    metricKey: "free_cash_flow_yield",
    metricValue: ratio(freeCashFlow, marketCap),
    periodEnd:
      maxIsoDate([
        metricPeriodEnd(sec, "operating_cash_flow", "quarter"),
        metricPeriodEnd(sec, "capex_cash", "quarter"),
        metricPeriodEnd(sec, "capex_incurred", "quarter"),
      ]) ?? priceDate,
    effectiveDate:
      maxIsoDate([
        marketCapEffectiveDate,
        operatingCashFlowEffectiveDate,
        metricEffectiveDate(sec, "capex_cash", "quarter"),
        metricEffectiveDate(sec, "capex_incurred", "quarter"),
      ]) ?? priceDate,
    sourcePayload: {
      formula: "(operating_cash_flow.ttm_val - capex.ttm_val) / market_cap",
      capexMetricKey:
        metricNumber(sec, "capex_cash", "quarter", "ttm_val") !== null
          ? "capex_cash"
          : "capex_incurred",
      priceDate,
      operatingCashFlowPeriodEnd: metricPeriodEnd(
        sec,
        "operating_cash_flow",
        "quarter",
      ),
      capexCashPeriodEnd: metricPeriodEnd(sec, "capex_cash", "quarter"),
      capexIncurredPeriodEnd: metricPeriodEnd(sec, "capex_incurred", "quarter"),
    },
  });

  addEnrichedRow(rows, {
    ticker: input.ticker,
    cik: input.cik,
    metricKey: "enterprise_value_to_sales",
    metricValue: ratio(
      enterpriseValue,
      metricNumber(sec, "revenue", "quarter", "ttm_val"),
    ),
    periodEnd:
      maxIsoDate([
        metricPeriodEnd(sec, "shares_outstanding", "instant"),
        metricPeriodEnd(sec, "total_debt", "instant"),
        metricPeriodEnd(sec, "short_term_debt", "instant"),
        metricPeriodEnd(sec, "long_term_debt", "instant"),
        metricPeriodEnd(sec, "cash_and_short_term_investments", "instant"),
        metricPeriodEnd(sec, "cash_and_cash_equivalents", "instant"),
        metricPeriodEnd(sec, "revenue", "quarter"),
      ]) ?? priceDate,
    effectiveDate:
      maxIsoDate([
        marketCapEffectiveDate,
        metricEffectiveDate(sec, "total_debt", "instant"),
        metricEffectiveDate(sec, "short_term_debt", "instant"),
        metricEffectiveDate(sec, "long_term_debt", "instant"),
        metricEffectiveDate(sec, "cash_and_short_term_investments", "instant"),
        metricEffectiveDate(sec, "cash_and_cash_equivalents", "instant"),
        revenueEffectiveDate,
      ]) ?? priceDate,
    sourcePayload: {
      formula:
        "(market_cap + debt.val - cash.val) / revenue.ttm_val",
      priceDate,
      debtMetricKey,
      cashMetricKey:
        metricNumber(sec, "cash_and_short_term_investments", "instant", "val") !==
        null
          ? "cash_and_short_term_investments"
          : "cash_and_cash_equivalents",
      sharesPeriodEnd: metricPeriodEnd(sec, "shares_outstanding", "instant"),
      totalDebtPeriodEnd: metricPeriodEnd(sec, "total_debt", "instant"),
      shortTermDebtPeriodEnd: metricPeriodEnd(sec, "short_term_debt", "instant"),
      longTermDebtPeriodEnd: metricPeriodEnd(sec, "long_term_debt", "instant"),
      cashAndShortTermInvestmentsPeriodEnd: metricPeriodEnd(
        sec,
        "cash_and_short_term_investments",
        "instant",
      ),
      cashAndCashEquivalentsPeriodEnd: metricPeriodEnd(
        sec,
        "cash_and_cash_equivalents",
        "instant",
      ),
      revenuePeriodEnd: metricPeriodEnd(sec, "revenue", "quarter"),
    },
  });

  const dividendPayments = metricNumber(sec, "dividend_payments", "quarter", "ttm_val");
  const dividendYield = ratio(dividendPayments, marketCap);
  const dividendPaymentsEffectiveDate = metricEffectiveDate(
    sec,
    "dividend_payments",
    "quarter",
  );
  addEnrichedRow(rows, {
    ticker: input.ticker,
    cik: input.cik,
    metricKey: "dividend_yield",
    metricValue: dividendYield,
    periodEnd: metricPeriodEnd(sec, "dividend_payments", "quarter") ?? priceDate,
    effectiveDate:
      maxIsoDate([marketCapEffectiveDate, dividendPaymentsEffectiveDate]) ??
      priceDate,
    sourcePayload: {
      formula: "dividend_payments.ttm_val / market_cap",
      priceDate,
      dividendPaymentsPeriodEnd: metricPeriodEnd(sec, "dividend_payments", "quarter"),
    },
  });

  const shareRepurchasesEffectiveDate = metricEffectiveDate(
    sec,
    "share_repurchases",
    "quarter",
  );
  const buybackYield = ratio(
    metricNumber(sec, "share_repurchases", "quarter", "ttm_val"),
    marketCap,
  );
  addMarketCapDenominatorRatio(rows, {
    ticker: input.ticker,
    cik: input.cik,
    numerator: metricNumber(sec, "share_repurchases", "quarter", "ttm_val"),
    marketCap,
    metricKey: "buyback_yield",
    periodEnd: metricPeriodEnd(sec, "share_repurchases", "quarter") ?? priceDate,
    effectiveDate:
      maxIsoDate([marketCapEffectiveDate, shareRepurchasesEffectiveDate]) ??
      priceDate,
    formula: "share_repurchases.ttm_val / market_cap",
  });

  const shareholderYield = sumNullable(dividendYield, buybackYield);
  addEnrichedRow(rows, {
    ticker: input.ticker,
    cik: input.cik,
    metricKey: "shareholder_yield",
    metricValue: shareholderYield,
    periodEnd:
      maxIsoDate([
        metricPeriodEnd(sec, "dividend_payments", "quarter"),
        metricPeriodEnd(sec, "share_repurchases", "quarter"),
      ]) ?? priceDate,
    effectiveDate:
      maxIsoDate([
        marketCapEffectiveDate,
        dividendPaymentsEffectiveDate,
        shareRepurchasesEffectiveDate,
      ]) ?? priceDate,
    sourcePayload: {
      formula: "dividend_yield + buyback_yield",
    },
  });

  addEnrichedRow(rows, {
    ticker: input.ticker,
    cik: input.cik,
    metricKey: "dividend_yield_share",
    metricValue: ratio(dividendYield, shareholderYield),
    periodEnd:
      maxIsoDate([
        metricPeriodEnd(sec, "dividend_payments", "quarter"),
        metricPeriodEnd(sec, "share_repurchases", "quarter"),
      ]) ?? priceDate,
    effectiveDate:
      maxIsoDate([
        marketCapEffectiveDate,
        dividendPaymentsEffectiveDate,
        shareRepurchasesEffectiveDate,
      ]) ?? priceDate,
    sourcePayload: {
      formula: "dividend_yield / shareholder_yield",
    },
  });

  addEnrichedRow(rows, {
    ticker: input.ticker,
    cik: input.cik,
    metricKey: "buyback_yield_share",
    metricValue: ratio(buybackYield, shareholderYield),
    periodEnd:
      maxIsoDate([
        metricPeriodEnd(sec, "dividend_payments", "quarter"),
        metricPeriodEnd(sec, "share_repurchases", "quarter"),
      ]) ?? priceDate,
    effectiveDate:
      maxIsoDate([
        marketCapEffectiveDate,
        dividendPaymentsEffectiveDate,
        shareRepurchasesEffectiveDate,
      ]) ?? priceDate,
    sourcePayload: {
      formula: "buyback_yield / shareholder_yield",
    },
  });

  return rows;
}

type SecMetricIndex = Map<string, SecMetricRow>;

function buildSecMetricIndex(rows: SecMetricRow[]): SecMetricIndex {
  return new Map(
    rows.map((row) => [
      buildSecMetricIndexKey(row.metric_key, row.period_type),
      row,
    ]),
  );
}

function buildSecMetricIndexKey(metricKey: string, periodType: string): string {
  return `${metricKey}:${periodType}`;
}

function metricNumber(
  index: SecMetricIndex,
  metricKey: string,
  periodType: "quarter" | "instant",
  field: "val" | "ttm_val" | "ttm_yoy",
): number | null {
  const row = index.get(buildSecMetricIndexKey(metricKey, periodType));
  return row ? toNullableNumber(row[field]) : null;
}

function metricPeriodEnd(
  index: SecMetricIndex,
  metricKey: string,
  periodType: "quarter" | "instant",
): string | null {
  const row = index.get(buildSecMetricIndexKey(metricKey, periodType));
  return row ? toIsoDate(row.end) : null;
}

function metricEffectiveDate(
  index: SecMetricIndex,
  metricKey: string,
  periodType: "quarter" | "instant",
): string | null {
  const row = index.get(buildSecMetricIndexKey(metricKey, periodType));
  return row ? toIsoDate(row.effective_date) : null;
}

function addPricePerShareRatio(
  rows: ValuationMetricRow[],
  input: {
    ticker: string;
    cik: string;
    close: number;
    denominator: number | null;
    metricKey: string;
    periodEnd: string;
    effectiveDate: string;
    formula: string;
  },
) {
  addEnrichedRow(rows, {
    ticker: input.ticker,
    cik: input.cik,
    metricKey: input.metricKey,
    metricValue: ratio(input.close, input.denominator),
    periodEnd: input.periodEnd,
    effectiveDate: input.effectiveDate,
    sourcePayload: {
      formula: input.formula,
      priceDate: input.effectiveDate,
    },
  });
}

function addMarketCapRatio(
  rows: ValuationMetricRow[],
  input: {
    ticker: string;
    cik: string;
    marketCap: number | null;
    denominator: number | null;
    metricKey: string;
    periodEnd: string;
    effectiveDate: string;
    formula: string;
  },
) {
  addEnrichedRow(rows, {
    ticker: input.ticker,
    cik: input.cik,
    metricKey: input.metricKey,
    metricValue: ratio(input.marketCap, input.denominator),
    periodEnd: input.periodEnd,
    effectiveDate: input.effectiveDate,
    sourcePayload: {
      formula: input.formula,
    },
  });
}

function addMarketCapDenominatorRatio(
  rows: ValuationMetricRow[],
  input: {
    ticker: string;
    cik: string;
    numerator: number | null;
    marketCap: number | null;
    metricKey: string;
    periodEnd: string;
    effectiveDate: string;
    formula: string;
  },
) {
  addEnrichedRow(rows, {
    ticker: input.ticker,
    cik: input.cik,
    metricKey: input.metricKey,
    metricValue: ratio(input.numerator, input.marketCap),
    periodEnd: input.periodEnd,
    effectiveDate: input.effectiveDate,
    sourcePayload: {
      formula: input.formula,
    },
  });
}

function addDirectSecMetric(
  rows: ValuationMetricRow[],
  input: {
    ticker: string;
    cik: string;
    metricKey: string;
    metricValue: number | null;
    periodEnd: string;
    effectiveDate: string;
    formula: string;
  },
) {
  addEnrichedRow(rows, {
    ...input,
    sourcePayload: {
      formula: input.formula,
    },
  });
}

function addEnrichedRow(
  rows: ValuationMetricRow[],
  input: {
    ticker: string;
    cik: string | null;
    metricKey: string;
    metricValue: number | null;
    periodEnd: string;
    effectiveDate: string;
    sourcePayload: Record<string, unknown>;
  },
) {
  if (input.metricValue === null || !Number.isFinite(input.metricValue)) return;
  const processKey = getValuationProcessKey(input.metricKey);

  rows.push({
    ticker: input.ticker,
    cik: input.cik,
    axis: "valuation",
    processKey,
    sourceKind: "valuation_composite",
    derivedMetricKey: input.metricKey,
    value: input.metricValue,
    valueType: getValuationValueType(input.metricKey),
    benchmarkKey: null,
    windowStart: null,
    windowEnd: null,
    periodEnd: input.periodEnd,
    effectiveDate: input.effectiveDate,
    sourcePayload: {
      ...input.sourcePayload,
      axis: "valuation",
      processKey,
      sourceKind: "valuation_composite",
      derivedMetricKey: input.metricKey,
    },
  });
}

function getValuationProcessKey(metricKey: string): string {
  if (
    metricKey === "market_capitalization" ||
    metricKey === "log_market_capitalization"
  ) {
    return "market_size";
  }

  if (metricKey === "diluted_ttm_eps_growth" || metricKey === "basic_ttm_eps_growth") {
    return "earnings_growth";
  }

  if (metricKey === "free_cash_flow_yield") {
    return "cash_flow_yield";
  }

  if (metricKey === "enterprise_value_to_sales") {
    return "enterprise_value";
  }

  if (
    metricKey === "dividend_yield" ||
    metricKey === "buyback_yield" ||
    metricKey === "shareholder_yield" ||
    metricKey === "dividend_yield_share" ||
    metricKey === "buyback_yield_share"
  ) {
    return "shareholder_yield";
  }

  return "valuation_multiples";
}

function getValuationValueType(metricKey: string): "ratio" | "value" {
  return metricKey === "market_capitalization" ||
    metricKey === "log_market_capitalization"
    ? "value"
    : "ratio";
}

function getDistinctEffectiveDates(rows: ValuationMetricRow[]): string[] {
  return [...new Set(rows.map((row) => row.effectiveDate))].sort();
}

function dedupeDerivedRows(rows: ValuationMetricRow[]): ValuationMetricRow[] {
  return Array.from(
    rows
      .reduce((deduped, row) => {
        deduped.set(
          [
            row.ticker,
            row.axis,
            row.processKey,
            row.sourceKind,
            row.derivedMetricKey,
            row.benchmarkKey ?? "",
            row.windowStart ?? "",
            row.windowEnd ?? "",
            row.periodEnd,
            row.effectiveDate,
            DERIVED_SOURCE_VERSION,
          ].join("|"),
          row,
        );
        return deduped;
      }, new Map<string, ValuationMetricRow>())
      .values(),
  );
}

async function deleteExistingDerivedRows(input: {
  tickers: string[];
  effectiveDates: string[];
}): Promise<void> {
  if (input.tickers.length === 0 || input.effectiveDates.length === 0) return;

  await db.query(
    `
    DELETE FROM public.ticker_derived_metric_series
    WHERE ticker = ANY($1::text[])
      AND axis = 'valuation'
      AND source_version = $2
      AND effective_date = ANY($3::date[])
    `,
    [input.tickers, DERIVED_SOURCE_VERSION, input.effectiveDates],
  );
}

async function upsertDerivedRows(rows: ValuationMetricRow[]): Promise<void> {
  if (rows.length === 0) return;

  for (let index = 0; index < rows.length; index += 500) {
    await upsertDerivedRowsChunk(rows.slice(index, index + 500));
  }
}

async function upsertDerivedRowsChunk(rows: ValuationMetricRow[]): Promise<void> {
  const values: unknown[] = [];
  const placeholders = rows.map((row, index) => {
    const offset = index * 16;

    values.push(
      row.ticker,
      row.cik,
      row.axis,
      row.processKey,
      row.sourceKind,
      row.derivedMetricKey,
      row.value,
      row.valueType,
      row.benchmarkKey,
      row.windowStart,
      row.windowEnd,
      row.periodEnd,
      row.effectiveDate,
      SOURCE_TABLE,
      DERIVED_SOURCE_VERSION,
      JSON.stringify(row.sourcePayload),
    );

    return `($${offset + 1},$${offset + 2},$${offset + 3},$${offset + 4},$${offset + 5},$${offset + 6},$${offset + 7},$${offset + 8},$${offset + 9},$${offset + 10},$${offset + 11},$${offset + 12},$${offset + 13},$${offset + 14},$${offset + 15},$${offset + 16}::jsonb)`;
  });

  await db.query(
    `
    INSERT INTO public.ticker_derived_metric_series (
      ticker,
      cik,
      axis,
      process_key,
      source_kind,
      derived_metric_key,
      value,
      value_type,
      benchmark_key,
      window_start,
      window_end,
      period_end,
      effective_date,
      source_table,
      source_version,
      source_payload
    )
    VALUES ${placeholders.join(",")}
    ON CONFLICT (
      ticker,
      axis,
      process_key,
      source_kind,
      derived_metric_key,
      benchmark_key,
      window_start,
      window_end,
      period_end,
      effective_date,
      source_version
    )
    DO UPDATE SET
      cik = EXCLUDED.cik,
      value = EXCLUDED.value,
      value_type = EXCLUDED.value_type,
      benchmark_key = EXCLUDED.benchmark_key,
      window_start = EXCLUDED.window_start,
      window_end = EXCLUDED.window_end,
      source_table = EXCLUDED.source_table,
      source_payload = EXCLUDED.source_payload,
      updated_at = now()
    `,
    values,
  );
}

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

function toNullableNumber(value: number | string | null): number | null {
  if (value === null) return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function addNumber(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}

function ratio(numerator: number | null, denominator: number | null): number | null {
  if (
    numerator === null ||
    denominator === null ||
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    denominator <= 0
  ) {
    return null;
  }

  return numerator / denominator;
}

function sumNullable(a: number | null, b: number | null): number | null {
  if (a === null && b === null) return null;
  return (a ?? 0) + (b ?? 0);
}

function firstNonNull(values: Array<number | null>): number | null {
  for (const value of values) {
    if (value !== null) return value;
  }

  return null;
}

function toIsoDate(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return new Date(value).toISOString().slice(0, 10);
}

function maxIsoDate(values: Array<string | null>): string | null {
  return values.reduce<string | null>((latest, value) => {
    if (!value) return latest;
    return !latest || value > latest ? value : latest;
  }, null);
}

function getLatestPriceDate(rows: LatestPriceRow[]): string | null {
  return rows.reduce<string | null>((latest, row) => {
    const date = toIsoDate(row.price_date);
    return !latest || date > latest ? date : latest;
  }, null);
}
