import { db } from "@/backend/config/db";

export type BuildTickerValuationFactorFeaturesInput = {
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

export type BuildTickerValuationFactorFeaturesResult = {
  tickerCount: number;
  enrichedRowCount: number;
  asOfDate: string | null;
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
  period_type: "quarter" | "instant";
};

type ValuationMetricRow = {
  ticker: string;
  cik: string | null;
  metricKey: string;
  metricValue: number;
  periodEnd: string;
  effectiveDate: string;
  sourcePayload: Record<string, unknown>;
};

const DEFAULT_PROVIDER = "twelve_data";
const DEFAULT_ADJUSTMENT_POLICY = "splits";
const SOURCE_TABLE =
  "ticker_daily_prices+sec_companyfact_metric_series_enriched";
const ENRICHED_TABLE = "ticker_valuation_metric_series_enriched";
const ENRICHED_SOURCE_VERSION = "valuation_metric_series_enriched_v0";
const SEC_METRIC_KEYS = [
  "eps_basic",
  "eps_diluted",
  "stockholders_equity",
  "revenue",
  "net_income",
  "operating_cash_flow",
  "dividends_per_share",
  "dividend_payments",
  "share_repurchases",
  "shares_outstanding",
] as const;

export async function buildTickerValuationFactorFeatures(
  input: BuildTickerValuationFactorFeaturesInput = {},
): Promise<BuildTickerValuationFactorFeaturesResult> {
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
    asOfDate: input.asOfDate,
  });
  const entries = Array.from(pricesByTicker.entries()).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const enrichedRows: ValuationMetricRow[] = [];

  for (const [index, [ticker, priceRow]] of entries.entries()) {
    input.onProgress?.({
      message: `Valuation metrics enriching ${ticker}.`,
      current: index + 1,
      total: entries.length,
      label: ticker,
    });

    const cik = ciksByTicker.get(ticker) ?? null;
    if (!cik) continue;

    enrichedRows.push(
      ...buildTickerEnrichedRows({
        ticker,
        cik,
        priceRow,
        secRows: secRowsByCik.get(cik) ?? [],
      }),
    );
  }

  const targetTickers = entries.map(([ticker]) => ticker);
  await deleteExistingEnrichedRows({ tickers: targetTickers });
  await upsertEnrichedRows(enrichedRows);

  return {
    tickerCount: entries.length,
    enrichedRowCount: enrichedRows.length,
    asOfDate: getLatestPriceDate(entries.map(([, row]) => row)),
  };
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
      period_type
    FROM public.sec_companyfact_metric_series_enriched
    WHERE cik = ANY($1::text[])
      AND metric_key = ANY($2::text[])
      AND period_type IN ('quarter', 'instant')
      AND ($3::date IS NULL OR "end" <= $3::date)
    ORDER BY cik ASC, metric_key ASC, period_type ASC, "end" DESC
    `,
    [input.ciks, [...SEC_METRIC_KEYS], input.asOfDate ?? null],
  );

  const grouped = new Map<string, SecMetricRow[]>();

  for (const row of result.rows) {
    grouped.set(row.cik, [...(grouped.get(row.cik) ?? []), row]);
  }

  return grouped;
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
  const effectiveDate = toIsoDate(input.priceRow.price_date);
  const shares = metricNumber(sec, "shares_outstanding", "instant", "val");
  const marketCap =
    shares !== null && shares > 0 ? addNumber(close * shares) : null;
  const rows: ValuationMetricRow[] = [];

  addEnrichedRow(rows, {
    ticker: input.ticker,
    cik: input.cik,
    metricKey: "marketCapitalization",
    metricValue: marketCap,
    periodEnd: metricPeriodEnd(sec, "shares_outstanding", "instant") ?? effectiveDate,
    effectiveDate,
    sourcePayload: {
      formula: "price.close * shares_outstanding.val",
      priceDate: effectiveDate,
      sharesPeriodEnd: metricPeriodEnd(sec, "shares_outstanding", "instant"),
    },
  });

  addEnrichedRow(rows, {
    ticker: input.ticker,
    cik: input.cik,
    metricKey: "logMarketCapitalization",
    metricValue: marketCap !== null && marketCap > 0 ? Math.log(marketCap) : null,
    periodEnd: metricPeriodEnd(sec, "shares_outstanding", "instant") ?? effectiveDate,
    effectiveDate,
    sourcePayload: {
      formula: "log(price.close * shares_outstanding.val)",
      priceDate: effectiveDate,
      sharesPeriodEnd: metricPeriodEnd(sec, "shares_outstanding", "instant"),
    },
  });

  addPricePerShareRatio(rows, {
    ticker: input.ticker,
    cik: input.cik,
    close,
    denominator: metricNumber(sec, "eps_diluted", "quarter", "ttm_val"),
    metricKey: "priceToDilutedTtmEps",
    periodEnd: metricPeriodEnd(sec, "eps_diluted", "quarter") ?? effectiveDate,
    effectiveDate,
    formula: "price.close / eps_diluted.ttm_val",
  });
  addPricePerShareRatio(rows, {
    ticker: input.ticker,
    cik: input.cik,
    close,
    denominator: metricNumber(sec, "eps_basic", "quarter", "ttm_val"),
    metricKey: "priceToBasicTtmEps",
    periodEnd: metricPeriodEnd(sec, "eps_basic", "quarter") ?? effectiveDate,
    effectiveDate,
    formula: "price.close / eps_basic.ttm_val",
  });

  addDirectSecMetric(rows, {
    ticker: input.ticker,
    cik: input.cik,
    metricKey: "dilutedTtmEpsGrowth",
    metricValue: metricNumber(sec, "eps_diluted", "quarter", "ttm_yoy"),
    periodEnd: metricPeriodEnd(sec, "eps_diluted", "quarter") ?? effectiveDate,
    effectiveDate,
    formula: "eps_diluted.ttm_yoy",
  });
  addDirectSecMetric(rows, {
    ticker: input.ticker,
    cik: input.cik,
    metricKey: "basicTtmEpsGrowth",
    metricValue: metricNumber(sec, "eps_basic", "quarter", "ttm_yoy"),
    periodEnd: metricPeriodEnd(sec, "eps_basic", "quarter") ?? effectiveDate,
    effectiveDate,
    formula: "eps_basic.ttm_yoy",
  });

  addMarketCapRatio(rows, {
    ticker: input.ticker,
    cik: input.cik,
    marketCap,
    denominator: metricNumber(sec, "stockholders_equity", "instant", "val"),
    metricKey: "priceToBook",
    periodEnd: metricPeriodEnd(sec, "stockholders_equity", "instant") ?? effectiveDate,
    effectiveDate,
    formula: "market_cap / stockholders_equity.val",
  });
  addMarketCapRatio(rows, {
    ticker: input.ticker,
    cik: input.cik,
    marketCap,
    denominator: metricNumber(sec, "revenue", "quarter", "ttm_val"),
    metricKey: "priceToSales",
    periodEnd: metricPeriodEnd(sec, "revenue", "quarter") ?? effectiveDate,
    effectiveDate,
    formula: "market_cap / revenue.ttm_val",
  });
  addMarketCapRatio(rows, {
    ticker: input.ticker,
    cik: input.cik,
    marketCap,
    denominator: metricNumber(sec, "net_income", "quarter", "ttm_val"),
    metricKey: "priceToEarnings",
    periodEnd: metricPeriodEnd(sec, "net_income", "quarter") ?? effectiveDate,
    effectiveDate,
    formula: "market_cap / net_income.ttm_val",
  });
  addMarketCapRatio(rows, {
    ticker: input.ticker,
    cik: input.cik,
    marketCap,
    denominator: metricNumber(sec, "operating_cash_flow", "quarter", "ttm_val"),
    metricKey: "priceToOperatingCashFlow",
    periodEnd: metricPeriodEnd(sec, "operating_cash_flow", "quarter") ?? effectiveDate,
    effectiveDate,
    formula: "market_cap / operating_cash_flow.ttm_val",
  });

  const dividendPayments = metricNumber(sec, "dividend_payments", "quarter", "ttm_val");
  const shareRepurchases = metricNumber(sec, "share_repurchases", "quarter", "ttm_val");
  const dividendYield = ratio(dividendPayments, marketCap);
  addEnrichedRow(rows, {
    ticker: input.ticker,
    cik: input.cik,
    metricKey: "dividendYield",
    metricValue: dividendYield,
    periodEnd: metricPeriodEnd(sec, "dividend_payments", "quarter") ?? effectiveDate,
    effectiveDate,
    sourcePayload: {
      formula: "dividend_payments.ttm_val / market_cap",
      priceDate: effectiveDate,
      dividendPaymentsPeriodEnd: metricPeriodEnd(sec, "dividend_payments", "quarter"),
    },
  });

  const buybackYield = ratio(
    metricNumber(sec, "share_repurchases", "quarter", "ttm_val"),
    marketCap,
  );
  addMarketCapDenominatorRatio(rows, {
    ticker: input.ticker,
    cik: input.cik,
    numerator: metricNumber(sec, "share_repurchases", "quarter", "ttm_val"),
    marketCap,
    metricKey: "buybackYield",
    periodEnd: metricPeriodEnd(sec, "share_repurchases", "quarter") ?? effectiveDate,
    effectiveDate,
    formula: "share_repurchases.ttm_val / market_cap",
  });

  const shareholderYield = sumNullable(dividendYield, buybackYield);
  addEnrichedRow(rows, {
    ticker: input.ticker,
    cik: input.cik,
    metricKey: "shareholderYield",
    metricValue: shareholderYield,
    periodEnd:
      maxIsoDate([
        metricPeriodEnd(sec, "dividend_payments", "quarter"),
        metricPeriodEnd(sec, "share_repurchases", "quarter"),
      ]) ?? effectiveDate,
    effectiveDate,
    sourcePayload: {
      formula: "dividendYield + buybackYield",
    },
  });

  addEnrichedRow(rows, {
    ticker: input.ticker,
    cik: input.cik,
    metricKey: "dividendYieldShare",
    metricValue: ratio(dividendYield, shareholderYield),
    periodEnd:
      maxIsoDate([
        metricPeriodEnd(sec, "dividend_payments", "quarter"),
        metricPeriodEnd(sec, "share_repurchases", "quarter"),
      ]) ?? effectiveDate,
    effectiveDate,
    sourcePayload: {
      formula: "dividendYield / shareholderYield",
    },
  });

  addEnrichedRow(rows, {
    ticker: input.ticker,
    cik: input.cik,
    metricKey: "buybackYieldShare",
    metricValue: ratio(buybackYield, shareholderYield),
    periodEnd:
      maxIsoDate([
        metricPeriodEnd(sec, "dividend_payments", "quarter"),
        metricPeriodEnd(sec, "share_repurchases", "quarter"),
      ]) ?? effectiveDate,
    effectiveDate,
    sourcePayload: {
      formula: "buybackYield / shareholderYield",
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

  rows.push({
    ticker: input.ticker,
    cik: input.cik,
    metricKey: input.metricKey,
    metricValue: input.metricValue,
    periodEnd: input.periodEnd,
    effectiveDate: input.effectiveDate,
    sourcePayload: input.sourcePayload,
  });
}

async function deleteExistingEnrichedRows(input: { tickers: string[] }): Promise<void> {
  if (input.tickers.length === 0) return;

  await db.query(
    `
    DELETE FROM public.ticker_valuation_metric_series_enriched
    WHERE ticker = ANY($1::text[])
    `,
    [input.tickers],
  );
}

async function upsertEnrichedRows(rows: ValuationMetricRow[]): Promise<void> {
  if (rows.length === 0) return;

  for (let index = 0; index < rows.length; index += 500) {
    await upsertEnrichedRowsChunk(rows.slice(index, index + 500));
  }
}

async function upsertEnrichedRowsChunk(rows: ValuationMetricRow[]): Promise<void> {
  const values: unknown[] = [];
  const placeholders = rows.map((row, index) => {
    const offset = index * 9;

    values.push(
      row.ticker,
      row.cik,
      row.metricKey,
      row.metricValue,
      row.periodEnd,
      row.effectiveDate,
      SOURCE_TABLE,
      ENRICHED_SOURCE_VERSION,
      JSON.stringify(row.sourcePayload),
    );

    return `($${offset + 1},$${offset + 2},$${offset + 3},$${offset + 4},$${offset + 5},$${offset + 6},$${offset + 7},$${offset + 8},$${offset + 9}::jsonb)`;
  });

  await db.query(
    `
    INSERT INTO public.ticker_valuation_metric_series_enriched (
      ticker,
      cik,
      metric_key,
      metric_value,
      period_end,
      effective_date,
      source_table,
      source_version,
      source_payload
    )
    VALUES ${placeholders.join(",")}
    ON CONFLICT (
      ticker,
      metric_key,
      period_end,
      effective_date
    )
    DO UPDATE SET
      cik = EXCLUDED.cik,
      metric_value = EXCLUDED.metric_value,
      source_table = EXCLUDED.source_table,
      source_version = EXCLUDED.source_version,
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
