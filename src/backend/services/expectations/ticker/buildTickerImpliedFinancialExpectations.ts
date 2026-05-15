import {
  DEFAULT_ADJUSTMENT_POLICY,
  DEFAULT_PROVIDER,
  TICKER_EXPECTATION_SOURCE_VERSION,
} from "@/backend/services/expectations/ticker/constants";
import { buildTickerExpectationRow } from "@/backend/services/expectations/ticker/buildTickerExpectationRow";
import {
  loadActiveAssumptionSets,
  upsertDefaultAssumptionSets,
} from "@/backend/services/expectations/ticker/expectationAssumptionRepository";
import {
  loadTickerExpectationSourceRows,
} from "@/backend/services/expectations/ticker/tickerExpectationSourceRepository";
import {
  deleteExistingExpectationRows,
  upsertExpectationRows,
} from "@/backend/services/expectations/ticker/tickerExpectationWriteRepository";
import {
  normalizeTicker,
  toIsoDate,
} from "@/backend/services/expectations/ticker/math";
import type { TickerExpectationSourceRow } from "@/backend/services/expectations/ticker/types";

export type BuildTickerImpliedFinancialExpectationsInput = {
  tickers?: string[];
  asOfDate?: string;
  provider?: string;
  adjustmentPolicy?: string;
  onProgress?: (progress: {
    message: string;
    current?: number;
    total?: number;
    label?: string;
  }) => void;
};

export type BuildTickerImpliedFinancialExpectationsResult = {
  tickerCount: number;
  expectationRowCount: number;
  asOfDate: string | null;
};

export async function buildTickerImpliedFinancialExpectations(
  input: BuildTickerImpliedFinancialExpectationsInput = {},
): Promise<BuildTickerImpliedFinancialExpectationsResult> {
  const provider = input.provider ?? DEFAULT_PROVIDER;
  const adjustmentPolicy = input.adjustmentPolicy ?? DEFAULT_ADJUSTMENT_POLICY;
  const tickers = input.tickers?.map(normalizeTicker).filter(Boolean) ?? [];

  await upsertDefaultAssumptionSets();

  const [assumptionSets, sourceRows] = await Promise.all([
    loadActiveAssumptionSets(),
    loadTickerExpectationSourceRows({
      tickers,
      asOfDate: input.asOfDate,
      provider,
      adjustmentPolicy,
    }),
  ]);
  const expectationRows = sourceRows.flatMap((sourceRow, index) => {
    input.onProgress?.({
      message: `Implied financial expectations building ${sourceRow.ticker}.`,
      current: index + 1,
      total: sourceRows.length,
      label: sourceRow.ticker,
    });

    return assumptionSets.map((assumptionSet) =>
      buildTickerExpectationRow({ sourceRow, assumptionSet }),
    );
  });

  await deleteExistingExpectationRows({
    tickers: sourceRows.map((row) => row.ticker),
    sourceVersion: TICKER_EXPECTATION_SOURCE_VERSION,
  });
  await upsertExpectationRows(expectationRows);

  return {
    tickerCount: sourceRows.length,
    expectationRowCount: expectationRows.length,
    asOfDate: getLatestAsOfDate(sourceRows),
  };
}

function getLatestAsOfDate(rows: TickerExpectationSourceRow[]): string | null {
  return rows.reduce<string | null>((latest, row) => {
    const date = toIsoDate(row.price_date);
    return !latest || date > latest ? date : latest;
  }, null);
}
