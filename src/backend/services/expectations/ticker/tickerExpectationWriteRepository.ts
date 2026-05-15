import { db } from "@/backend/config/db";
import type { TickerExpectationBuildRow } from "@/backend/services/expectations/ticker/types";

export async function deleteExistingExpectationRows(input: {
  tickers: string[];
  sourceVersion: string;
}): Promise<void> {
  if (input.tickers.length === 0) return;

  await db.query(
    `
    DELETE FROM public.ticker_implied_financial_expectations
    WHERE ticker = ANY($1::text[])
      AND source_version = $2
    `,
    [input.tickers, input.sourceVersion],
  );
}

export async function upsertExpectationRows(
  rows: TickerExpectationBuildRow[],
): Promise<void> {
  if (rows.length === 0) return;

  for (let index = 0; index < rows.length; index += 250) {
    await upsertExpectationRowsChunk(rows.slice(index, index + 250));
  }
}

async function upsertExpectationRowsChunk(
  rows: TickerExpectationBuildRow[],
): Promise<void> {
  const values: unknown[] = [];
  const placeholders = rows.map((row, index) => {
    const offset = index * 34;
    values.push(...buildExpectationRowValues(row));
    return `($${offset + 1},$${offset + 2},$${offset + 3},$${offset + 4},$${offset + 5},$${offset + 6},$${offset + 7},$${offset + 8},$${offset + 9},$${offset + 10},$${offset + 11},$${offset + 12},$${offset + 13},$${offset + 14},$${offset + 15},$${offset + 16},$${offset + 17},$${offset + 18},$${offset + 19},$${offset + 20},$${offset + 21},$${offset + 22},$${offset + 23},$${offset + 24},$${offset + 25},$${offset + 26},$${offset + 27},$${offset + 28},$${offset + 29},$${offset + 30},$${offset + 31},$${offset + 32},$${offset + 33},$${offset + 34}::jsonb)`;
  });

  await db.query(
    `
    INSERT INTO public.ticker_implied_financial_expectations (
      ticker, cik, assumption_set_key, as_of_date, source_version,
      current_price, current_market_cap, current_enterprise_value,
      current_revenue_ttm, current_operating_income_ttm, current_net_income_ttm,
      current_eps_ttm, current_shares_outstanding, current_operating_margin,
      current_net_margin, current_ev_sales_multiple, current_pe_multiple,
      horizon_years, discount_rate, terminal_ev_sales_multiple,
      terminal_pe_multiple, terminal_operating_margin,
      implied_terminal_enterprise_value, implied_terminal_equity_value,
      implied_revenue_terminal, implied_revenue_cagr,
      implied_operating_income_terminal, implied_net_income_terminal,
      implied_net_income_cagr, implied_eps_terminal, implied_eps_cagr,
      expectation_burden_score, valuation_fragility_score, source_payload
    )
    VALUES ${placeholders.join(",")}
    ON CONFLICT (ticker, assumption_set_key, as_of_date, source_version)
    DO UPDATE SET
      cik = EXCLUDED.cik,
      current_price = EXCLUDED.current_price,
      current_market_cap = EXCLUDED.current_market_cap,
      current_enterprise_value = EXCLUDED.current_enterprise_value,
      current_revenue_ttm = EXCLUDED.current_revenue_ttm,
      current_operating_income_ttm = EXCLUDED.current_operating_income_ttm,
      current_net_income_ttm = EXCLUDED.current_net_income_ttm,
      current_eps_ttm = EXCLUDED.current_eps_ttm,
      current_shares_outstanding = EXCLUDED.current_shares_outstanding,
      current_operating_margin = EXCLUDED.current_operating_margin,
      current_net_margin = EXCLUDED.current_net_margin,
      current_ev_sales_multiple = EXCLUDED.current_ev_sales_multiple,
      current_pe_multiple = EXCLUDED.current_pe_multiple,
      horizon_years = EXCLUDED.horizon_years,
      discount_rate = EXCLUDED.discount_rate,
      terminal_ev_sales_multiple = EXCLUDED.terminal_ev_sales_multiple,
      terminal_pe_multiple = EXCLUDED.terminal_pe_multiple,
      terminal_operating_margin = EXCLUDED.terminal_operating_margin,
      implied_terminal_enterprise_value = EXCLUDED.implied_terminal_enterprise_value,
      implied_terminal_equity_value = EXCLUDED.implied_terminal_equity_value,
      implied_revenue_terminal = EXCLUDED.implied_revenue_terminal,
      implied_revenue_cagr = EXCLUDED.implied_revenue_cagr,
      implied_operating_income_terminal = EXCLUDED.implied_operating_income_terminal,
      implied_net_income_terminal = EXCLUDED.implied_net_income_terminal,
      implied_net_income_cagr = EXCLUDED.implied_net_income_cagr,
      implied_eps_terminal = EXCLUDED.implied_eps_terminal,
      implied_eps_cagr = EXCLUDED.implied_eps_cagr,
      expectation_burden_score = EXCLUDED.expectation_burden_score,
      valuation_fragility_score = EXCLUDED.valuation_fragility_score,
      source_payload = EXCLUDED.source_payload,
      updated_at = now()
    `,
    values,
  );
}

function buildExpectationRowValues(row: TickerExpectationBuildRow): unknown[] {
  return [
    row.ticker,
    row.cik,
    row.assumption_set_key,
    row.as_of_date,
    row.source_version,
    row.current_price,
    row.current_market_cap,
    row.current_enterprise_value,
    row.current_revenue_ttm,
    row.current_operating_income_ttm,
    row.current_net_income_ttm,
    row.current_eps_ttm,
    row.current_shares_outstanding,
    row.current_operating_margin,
    row.current_net_margin,
    row.current_ev_sales_multiple,
    row.current_pe_multiple,
    row.horizon_years,
    row.discount_rate,
    row.terminal_ev_sales_multiple,
    row.terminal_pe_multiple,
    row.terminal_operating_margin,
    row.implied_terminal_enterprise_value,
    row.implied_terminal_equity_value,
    row.implied_revenue_terminal,
    row.implied_revenue_cagr,
    row.implied_operating_income_terminal,
    row.implied_net_income_terminal,
    row.implied_net_income_cagr,
    row.implied_eps_terminal,
    row.implied_eps_cagr,
    row.expectation_burden_score,
    row.valuation_fragility_score,
    JSON.stringify(row.source_payload),
  ];
}
