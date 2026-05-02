import type { TickerOverviewFactorMetric } from "@/shared/tickers/tickerOverview";
import { Field, Panel } from "@/features/tickers/components/TickerDetailPrimitives";
import {
  formatLabel,
  formatMethodLabel,
  formatPercentile,
  formatSignalValue,
  formatSignedSignalValue,
} from "@/features/tickers/utils/formatters";

export function TickerHeadlineMetricPanel({
  metric,
}: {
  metric: TickerOverviewFactorMetric | null;
}) {
  const headline = metric?.headline ?? null;
  const usPublicEquitiesPosition = metric?.positions?.find(
    (position) => position.comparisonSetType === "us_public_equities",
  );
  const sectorPosition = metric?.positions?.find(
    (position) => position.comparisonSetType === "sector",
  );

  return (
    <Panel title="Signal Headline">
      {metric && headline ? (
        <div className="grid gap-3">
          <Field label="Factor" value={formatLabel(metric.factor)} />
          <Field label="Axis" value={formatLabel(metric.axis)} />
          <Field label="Metric" value={formatLabel(metric.metricKey)} />
          <Field
            label="Primary Signal"
            value={`${formatLabel(headline.primarySignalKey ?? "-")} ${formatSignalValue(headline.primarySignalValue)}`}
            valueClassName="font-bold"
          />
          <Field
            label="Growth Read"
            value={
              <span>
                <span className="font-bold">
                  {headline.interpretationLabel ?? "-"}
                </span>
                {headline.interpretationSummary ? (
                  <span className="mt-1 block text-sm leading-snug">
                    {headline.interpretationSummary}
                  </span>
                ) : null}
              </span>
            }
          />
          <Field label="Method" value={formatMethodLabel(headline.primarySignalMethod ?? metric.method)} />
          <Field label="Period End" value={headline.headlinePeriodEnd ?? "-"} />
          <Field
            label="Position Date"
            value={
              usPublicEquitiesPosition?.effectiveDate ??
              sectorPosition?.effectiveDate ??
              "-"
            }
          />
          <Field label="Coverage" value={formatSignalValue(headline.coverageValue)} />
          <Field label="Quality" value={formatLabel(headline.dataQualityLevel ?? "-")} />
          <Field
            label="US Equities Position"
            value={`${formatPercentile(usPublicEquitiesPosition?.percentile ?? null)} | Δ median ${formatSignedSignalValue(usPublicEquitiesPosition?.distanceToMedian ?? null)} | z ${formatZScore(usPublicEquitiesPosition?.zScore ?? null)}`}
          />
          <Field
            label="Sector Position"
            value={`${formatPercentile(sectorPosition?.percentile ?? null)} | Δ median ${formatSignedSignalValue(sectorPosition?.distanceToMedian ?? null)} | z ${formatZScore(sectorPosition?.zScore ?? null)}`}
          />
        </div>
      ) : (
        <p className="font-mono text-sm">No signal headline available.</p>
      )}
    </Panel>
  );
}

function formatZScore(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return value.toFixed(2);
}
