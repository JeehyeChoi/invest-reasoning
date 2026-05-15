export type ExpectationAssumptionSet = {
  assumptionSetKey: string;
  name: string;
  description: string | null;
  horizonYears: number;
  discountRate: number;
  terminalEvSalesMultiple: number | null;
  terminalPeMultiple: number | null;
  terminalOperatingMargin: number | null;
  isActive: boolean;
  displayOrder: number;
};

export type TickerImpliedFinancialExpectation = {
  ticker: string;
  cik: string | null;
  assumptionSetKey: string;
  asOfDate: string;
  sourceVersion: string;
  currentPrice: number | null;
  currentMarketCap: number | null;
  currentEnterpriseValue: number | null;
  currentRevenueTtm: number | null;
  currentOperatingIncomeTtm: number | null;
  currentNetIncomeTtm: number | null;
  currentEpsTtm: number | null;
  currentSharesOutstanding: number | null;
  currentOperatingMargin: number | null;
  currentNetMargin: number | null;
  currentEvSalesMultiple: number | null;
  currentPeMultiple: number | null;
  horizonYears: number;
  discountRate: number;
  terminalEvSalesMultiple: number | null;
  terminalPeMultiple: number | null;
  terminalOperatingMargin: number | null;
  impliedTerminalEnterpriseValue: number | null;
  impliedTerminalEquityValue: number | null;
  impliedRevenueTerminal: number | null;
  impliedRevenueCagr: number | null;
  impliedOperatingIncomeTerminal: number | null;
  impliedNetIncomeTerminal: number | null;
  impliedNetIncomeCagr: number | null;
  impliedEpsTerminal: number | null;
  impliedEpsCagr: number | null;
  expectationBurdenScore: number | null;
  valuationFragilityScore: number | null;
};

export type TickerImpliedFinancialExpectationsResponse = {
  ticker: string;
  asOfDate: string | null;
  assumptions: ExpectationAssumptionSet[];
  expectations: TickerImpliedFinancialExpectation[];
};
