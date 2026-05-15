import { db } from "@/backend/config/db";
import { EXPECTATION_SOURCE_METRIC_KEYS } from "@/backend/services/expectations/ticker/constants";
import { normalizeTicker } from "@/backend/services/expectations/ticker/math";
import type { TickerExpectationSourceRow } from "@/backend/services/expectations/ticker/types";

export async function loadTickerExpectationSourceRows(input: {
  tickers: string[];
  asOfDate?: string;
  provider: string;
  adjustmentPolicy: string;
}): Promise<TickerExpectationSourceRow[]> {
  const result = await db.query<TickerExpectationSourceRow>(
    `
    WITH latest_prices AS (
      SELECT DISTINCT ON (p.ticker)
        p.ticker,
        p.price_date,
        p.close AS current_price
      FROM public.ticker_daily_prices p
      WHERE p.provider = $1
        AND p.adjustment_policy = $2
        AND ($3::date IS NULL OR p.price_date <= $3::date)
        AND ($4::text[] IS NULL OR p.ticker = ANY($4::text[]))
      ORDER BY p.ticker ASC, p.price_date DESC
    ),
    latest_metrics AS (
      SELECT DISTINCT ON (m.cik, m.metric_key, m.period_type)
        m.cik,
        m.metric_key,
        m.val,
        m.ttm_val,
        m."end"
      FROM public.sec_companyfact_metric_series_enriched m
      WHERE m.metric_key = ANY($5::text[])
        AND m.period_type IN ('quarter', 'instant')
        AND ($3::date IS NULL OR m."end" <= $3::date)
      ORDER BY m.cik ASC, m.metric_key ASC, m.period_type ASC, m."end" DESC
    ),
    metric_pivot AS (
      SELECT
        cik,
        MAX(ttm_val) FILTER (WHERE metric_key = 'revenue') AS current_revenue_ttm,
        MAX(ttm_val) FILTER (WHERE metric_key = 'operating_income') AS current_operating_income_ttm,
        MAX(ttm_val) FILTER (WHERE metric_key = 'net_income') AS current_net_income_ttm,
        MAX(ttm_val) FILTER (WHERE metric_key = 'eps_diluted') AS current_eps_ttm,
        MAX(val) FILTER (WHERE metric_key = 'shares_outstanding') AS current_shares_outstanding,
        MAX(val) FILTER (WHERE metric_key = 'total_debt') AS total_debt,
        MAX(val) FILTER (WHERE metric_key = 'short_term_debt') AS short_term_debt,
        MAX(val) FILTER (WHERE metric_key = 'long_term_debt') AS long_term_debt,
        MAX(val) FILTER (WHERE metric_key = 'cash_and_short_term_investments') AS cash_and_short_term_investments,
        MAX(val) FILTER (WHERE metric_key = 'cash_and_cash_equivalents') AS cash_and_cash_equivalents
      FROM latest_metrics
      GROUP BY cik
    )
    SELECT
      i.ticker,
      i.cik,
      lp.price_date,
      lp.current_price,
      CASE
        WHEN mp.current_shares_outstanding > 0 AND lp.current_price > 0
          THEN mp.current_shares_outstanding * lp.current_price
        ELSE NULL
      END AS current_market_cap,
      CASE
        WHEN mp.current_shares_outstanding > 0 AND lp.current_price > 0
          THEN
            (mp.current_shares_outstanding * lp.current_price)
            + COALESCE(mp.total_debt, mp.short_term_debt + mp.long_term_debt, mp.short_term_debt, mp.long_term_debt, 0)
            - COALESCE(mp.cash_and_short_term_investments, mp.cash_and_cash_equivalents, 0)
        ELSE NULL
      END AS current_enterprise_value,
      mp.current_revenue_ttm,
      mp.current_operating_income_ttm,
      mp.current_net_income_ttm,
      mp.current_eps_ttm,
      mp.current_shares_outstanding
    FROM latest_prices lp
    JOIN public.ticker_identities i
      ON i.ticker = lp.ticker
    LEFT JOIN metric_pivot mp
      ON mp.cik = i.cik
    ORDER BY i.ticker ASC
    `,
    [
      input.provider,
      input.adjustmentPolicy,
      input.asOfDate ?? null,
      input.tickers.length > 0 ? input.tickers : null,
      [...EXPECTATION_SOURCE_METRIC_KEYS],
    ],
  );

  return result.rows.filter((row) => normalizeTicker(row.ticker));
}
