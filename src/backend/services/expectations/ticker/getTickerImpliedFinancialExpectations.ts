import { db } from "@/backend/config/db";

import type {
  ExpectationAssumptionSet,
  TickerImpliedFinancialExpectation,
  TickerImpliedFinancialExpectationsResponse,
} from "@/shared/expectations/tickerImpliedFinancialExpectations";
import type {
  ExpectationAssumptionSetRow,
  TickerImpliedFinancialExpectationRow,
} from "@/backend/services/expectations/ticker/types";

export async function getTickerImpliedFinancialExpectations(
  ticker: string,
): Promise<TickerImpliedFinancialExpectationsResponse> {
  const normalizedTicker = normalizeTicker(ticker);

  const [assumptionResult, expectationResult] = await Promise.all([
    db.query<ExpectationAssumptionSetRow>(
      `
      SELECT
        assumption_set_key,
        name,
        description,
        horizon_years,
        discount_rate,
        terminal_ev_sales_multiple,
        terminal_pe_multiple,
        terminal_operating_margin,
        is_active,
        display_order
      FROM public.expectation_assumption_sets
      WHERE is_active = true
      ORDER BY display_order ASC, assumption_set_key ASC
      `,
    ),
    db.query<TickerImpliedFinancialExpectationRow>(
      `
      WITH latest_as_of AS (
        SELECT MAX(as_of_date) AS as_of_date
        FROM public.ticker_implied_financial_expectations
        WHERE ticker = $1
      )
      SELECT
        e.ticker,
        e.cik,
        e.assumption_set_key,
        e.as_of_date,
        e.source_version,
        e.current_price,
        e.current_market_cap,
        e.current_enterprise_value,
        e.current_revenue_ttm,
        e.current_operating_income_ttm,
        e.current_net_income_ttm,
        e.current_eps_ttm,
        e.current_shares_outstanding,
        e.current_operating_margin,
        e.current_net_margin,
        e.current_ev_sales_multiple,
        e.current_pe_multiple,
        e.horizon_years,
        e.discount_rate,
        e.terminal_ev_sales_multiple,
        e.terminal_pe_multiple,
        e.terminal_operating_margin,
        e.implied_terminal_enterprise_value,
        e.implied_terminal_equity_value,
        e.implied_revenue_terminal,
        e.implied_revenue_cagr,
        e.implied_operating_income_terminal,
        e.implied_net_income_terminal,
        e.implied_net_income_cagr,
        e.implied_eps_terminal,
        e.implied_eps_cagr,
        e.expectation_burden_score,
        e.valuation_fragility_score
      FROM public.ticker_implied_financial_expectations e
      JOIN public.expectation_assumption_sets s
        ON s.assumption_set_key = e.assumption_set_key
      WHERE e.ticker = $1
        AND e.as_of_date = (SELECT as_of_date FROM latest_as_of)
      ORDER BY s.display_order ASC, e.assumption_set_key ASC
      `,
      [normalizedTicker],
    ),
  ]);

  const expectations = expectationResult.rows.map(mapExpectationRow);

  return {
    ticker: normalizedTicker,
    asOfDate: expectations[0]?.asOfDate ?? null,
    assumptions: assumptionResult.rows.map(mapAssumptionSetRow),
    expectations,
  };
}

function mapAssumptionSetRow(
  row: ExpectationAssumptionSetRow,
): ExpectationAssumptionSet {
  return {
    assumptionSetKey: row.assumption_set_key,
    name: row.name,
    description: row.description,
    horizonYears: Number(row.horizon_years),
    discountRate: Number(row.discount_rate),
    terminalEvSalesMultiple: toNullableNumber(
      row.terminal_ev_sales_multiple,
    ),
    terminalPeMultiple: toNullableNumber(row.terminal_pe_multiple),
    terminalOperatingMargin: toNullableNumber(
      row.terminal_operating_margin,
    ),
    isActive: row.is_active,
    displayOrder: Number(row.display_order),
  };
}

function mapExpectationRow(
  row: TickerImpliedFinancialExpectationRow,
): TickerImpliedFinancialExpectation {
  return {
    ticker: row.ticker,
    cik: row.cik,
    assumptionSetKey: row.assumption_set_key,
    asOfDate: toIsoDate(row.as_of_date),
    sourceVersion: row.source_version,
    currentPrice: toNullableNumber(row.current_price),
    currentMarketCap: toNullableNumber(row.current_market_cap),
    currentEnterpriseValue: toNullableNumber(row.current_enterprise_value),
    currentRevenueTtm: toNullableNumber(row.current_revenue_ttm),
    currentOperatingIncomeTtm: toNullableNumber(
      row.current_operating_income_ttm,
    ),
    currentNetIncomeTtm: toNullableNumber(row.current_net_income_ttm),
    currentEpsTtm: toNullableNumber(row.current_eps_ttm),
    currentSharesOutstanding: toNullableNumber(
      row.current_shares_outstanding,
    ),
    currentOperatingMargin: toNullableNumber(row.current_operating_margin),
    currentNetMargin: toNullableNumber(row.current_net_margin),
    currentEvSalesMultiple: toNullableNumber(row.current_ev_sales_multiple),
    currentPeMultiple: toNullableNumber(row.current_pe_multiple),
    horizonYears: Number(row.horizon_years),
    discountRate: Number(row.discount_rate),
    terminalEvSalesMultiple: toNullableNumber(
      row.terminal_ev_sales_multiple,
    ),
    terminalPeMultiple: toNullableNumber(row.terminal_pe_multiple),
    terminalOperatingMargin: toNullableNumber(
      row.terminal_operating_margin,
    ),
    impliedTerminalEnterpriseValue: toNullableNumber(
      row.implied_terminal_enterprise_value,
    ),
    impliedTerminalEquityValue: toNullableNumber(
      row.implied_terminal_equity_value,
    ),
    impliedRevenueTerminal: toNullableNumber(row.implied_revenue_terminal),
    impliedRevenueCagr: toNullableNumber(row.implied_revenue_cagr),
    impliedOperatingIncomeTerminal: toNullableNumber(
      row.implied_operating_income_terminal,
    ),
    impliedNetIncomeTerminal: toNullableNumber(
      row.implied_net_income_terminal,
    ),
    impliedNetIncomeCagr: toNullableNumber(row.implied_net_income_cagr),
    impliedEpsTerminal: toNullableNumber(row.implied_eps_terminal),
    impliedEpsCagr: toNullableNumber(row.implied_eps_cagr),
    expectationBurdenScore: toNullableNumber(
      row.expectation_burden_score,
    ),
    valuationFragilityScore: toNullableNumber(
      row.valuation_fragility_score,
    ),
  };
}

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
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
