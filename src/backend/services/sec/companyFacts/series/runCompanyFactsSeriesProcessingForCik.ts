import { buildCompanyFactsMetricSeriesForCik } from "@/backend/services/sec/companyFacts/series/metric/buildCompanyFactsMetricSeriesForCik";
import { assignPeriodLabelsToMetricSeriesForCik } from "@/backend/services/sec/companyFacts/series/period/assignPeriodLabelsToMetricSeriesForCik";
import { runValidateMetricSeriesForCik } from "@/backend/services/sec/companyFacts/series/validation/runValidateMetricSeriesForCik";

export type RunCompanyFactsSeriesProcessingForCikResult = {
  validationWarningCount: number | null;
  validationErrorCount: number | null;
};

export async function runCompanyFactsSeriesProcessingForCik(input: {
  ticker: string;
  cik: string;
  validate?: boolean;
}): Promise<RunCompanyFactsSeriesProcessingForCikResult> {
  await buildCompanyFactsMetricSeriesForCik({
    ticker: input.ticker,
    cik: input.cik,
  });

  await assignPeriodLabelsToMetricSeriesForCik({
    ticker: input.ticker,
    cik: input.cik,
  });

  if (!input.validate) {
    return {
      validationWarningCount: null,
      validationErrorCount: null,
    };
  }

  const { report } = await runValidateMetricSeriesForCik({
    ticker: input.ticker,
    cik: input.cik,
  });

  return {
    validationWarningCount: report.warningCount,
    validationErrorCount: report.errorCount,
  };
}
