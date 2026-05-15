import { TICKER_EXPECTATION_SOURCE_VERSION } from "@/backend/services/expectations/ticker/constants";
import {
  cagr,
  multiplyNullable,
  ratio,
  toIsoDate,
  toNullableNumber,
  normalizeTicker,
} from "@/backend/services/expectations/ticker/math";
import {
  buildExpectationBurdenScore,
  buildValuationFragilityScore,
} from "@/backend/services/expectations/ticker/scoreTickerExpectation";
import type {
  ExpectationAssumptionSetRow,
  TickerExpectationBuildRow,
  TickerExpectationSourceRow,
} from "@/backend/services/expectations/ticker/types";

export function buildTickerExpectationRow(input: {
  sourceRow: TickerExpectationSourceRow;
  assumptionSet: ExpectationAssumptionSetRow;
}): TickerExpectationBuildRow {
  const source = normalizeSourceRow(input.sourceRow);
  const assumption = normalizeAssumptionSet(input.assumptionSet);
  const discountFactor = Math.pow(
    1 + assumption.discountRate,
    assumption.horizonYears,
  );
  const impliedTerminalEnterpriseValue = multiplyNullable(
    source.currentEnterpriseValue,
    discountFactor,
  );
  const impliedTerminalEquityValue = multiplyNullable(
    source.currentMarketCap,
    discountFactor,
  );
  const impliedRevenueTerminal = ratio(
    impliedTerminalEnterpriseValue,
    assumption.terminalEvSalesMultiple,
  );
  const impliedRevenueCagr = cagr(
    source.currentRevenueTtm,
    impliedRevenueTerminal,
    assumption.horizonYears,
  );
  const impliedOperatingIncomeTerminal = multiplyNullable(
    impliedRevenueTerminal,
    assumption.terminalOperatingMargin,
  );
  const impliedNetIncomeTerminal = ratio(
    impliedTerminalEquityValue,
    assumption.terminalPeMultiple,
  );
  const impliedNetIncomeCagr = cagr(
    source.currentNetIncomeTtm,
    impliedNetIncomeTerminal,
    assumption.horizonYears,
  );
  const impliedEpsTerminal = ratio(
    impliedNetIncomeTerminal,
    source.currentSharesOutstanding,
  );
  const impliedEpsCagr = cagr(
    source.currentEpsTtm,
    impliedEpsTerminal,
    assumption.horizonYears,
  );
  const currentOperatingMargin = ratio(
    source.currentOperatingIncomeTtm,
    source.currentRevenueTtm,
  );
  const currentNetMargin = ratio(
    source.currentNetIncomeTtm,
    source.currentRevenueTtm,
  );
  const currentEvSalesMultiple = ratio(
    source.currentEnterpriseValue,
    source.currentRevenueTtm,
  );
  const currentPeMultiple = ratio(
    source.currentMarketCap,
    source.currentNetIncomeTtm,
  );

  return {
    ticker: source.ticker,
    cik: source.cik,
    assumption_set_key: assumption.assumptionSetKey,
    as_of_date: source.asOfDate,
    source_version: TICKER_EXPECTATION_SOURCE_VERSION,
    current_price: source.currentPrice,
    current_market_cap: source.currentMarketCap,
    current_enterprise_value: source.currentEnterpriseValue,
    current_revenue_ttm: source.currentRevenueTtm,
    current_operating_income_ttm: source.currentOperatingIncomeTtm,
    current_net_income_ttm: source.currentNetIncomeTtm,
    current_eps_ttm: source.currentEpsTtm,
    current_shares_outstanding: source.currentSharesOutstanding,
    current_operating_margin: currentOperatingMargin,
    current_net_margin: currentNetMargin,
    current_ev_sales_multiple: currentEvSalesMultiple,
    current_pe_multiple: currentPeMultiple,
    horizon_years: assumption.horizonYears,
    discount_rate: assumption.discountRate,
    terminal_ev_sales_multiple: assumption.terminalEvSalesMultiple,
    terminal_pe_multiple: assumption.terminalPeMultiple,
    terminal_operating_margin: assumption.terminalOperatingMargin,
    implied_terminal_enterprise_value: impliedTerminalEnterpriseValue,
    implied_terminal_equity_value: impliedTerminalEquityValue,
    implied_revenue_terminal: impliedRevenueTerminal,
    implied_revenue_cagr: impliedRevenueCagr,
    implied_operating_income_terminal: impliedOperatingIncomeTerminal,
    implied_net_income_terminal: impliedNetIncomeTerminal,
    implied_net_income_cagr: impliedNetIncomeCagr,
    implied_eps_terminal: impliedEpsTerminal,
    implied_eps_cagr: impliedEpsCagr,
    expectation_burden_score: buildExpectationBurdenScore({
      impliedRevenueCagr,
      impliedNetIncomeCagr,
      terminalOperatingMargin: assumption.terminalOperatingMargin,
    }),
    valuation_fragility_score: buildValuationFragilityScore({
      currentEvSalesMultiple,
      currentPeMultiple,
      terminalEvSalesMultiple: assumption.terminalEvSalesMultiple,
      terminalPeMultiple: assumption.terminalPeMultiple,
    }),
    source_payload: {
      formula:
        "current valuation compounded by discount rate over horizon, divided by terminal multiple",
      sourceTables:
        "ticker_daily_prices+sec_companyfact_metric_series_enriched+ticker_identities",
    },
  };
}

function normalizeSourceRow(row: TickerExpectationSourceRow) {
  return {
    ticker: normalizeTicker(row.ticker),
    cik: row.cik,
    asOfDate: toIsoDate(row.price_date),
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
  };
}

function normalizeAssumptionSet(row: ExpectationAssumptionSetRow) {
  return {
    assumptionSetKey: row.assumption_set_key,
    horizonYears: Number(row.horizon_years),
    discountRate: Number(row.discount_rate),
    terminalEvSalesMultiple: toNullableNumber(
      row.terminal_ev_sales_multiple,
    ),
    terminalPeMultiple: toNullableNumber(row.terminal_pe_multiple),
    terminalOperatingMargin: toNullableNumber(
      row.terminal_operating_margin,
    ),
  };
}
