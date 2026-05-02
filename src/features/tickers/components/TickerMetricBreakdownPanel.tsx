import type { TickerOverviewFactorMetric } from "@/shared/tickers/tickerOverview";
import { Panel, Td, Th } from "@/features/tickers/components/TickerDetailPrimitives";
import {
  formatLabel,
  formatPercentile,
  formatSignalValue,
  formatSignedSignalValue,
} from "@/features/tickers/utils/formatters";

type BreakdownRow = {
  key: string;
  label: string;
  value: unknown;
};

export function TickerMetricBreakdownPanel({
  metric,
}: {
  metric: TickerOverviewFactorMetric | null;
}) {
  const rows = buildMetricBreakdownRows(metric);

  return (
    <Panel
      title={
        metric
          ? `Metric Breakdown (${formatLabel(metric.metricKey)})`
          : "Metric Breakdown"
      }
    >
      {metric ? (
        <div className="space-y-3">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[#c0c0c0]">
                  <Th>Metric</Th>
                  <Th>Value</Th>
                </tr>
              </thead>
              <tbody>
                {rows.length > 0 ? (
                  rows.map((row) => (
                    <tr key={row.key} className="bg-white">
                      <Td>{row.label}</Td>
                      <Td>{String(row.value)}</Td>
                    </tr>
                  ))
                ) : (
                  <tr className="bg-white">
                    <Td colSpan={2}>No breakdown available.</Td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

					{metric.display?.formula?.show ? (
						<div className="border border-black bg-[#c0c0c0] px-2 py-2 text-xs">
							<span className="font-bold">Formula:</span>{" "}
							{metric.display?.formula?.text ?? "-"}
						</div>
					) : null}

          {metric.interpretation ? (
            <div className="border border-black bg-white px-2 py-2 text-sm">
              <span className="font-bold">Interpretation:</span>{" "}
              {metric.interpretation}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="font-mono text-sm">No metric selected.</p>
      )}
    </Panel>
  );
}

function buildMetricBreakdownRows(
  metric: TickerOverviewFactorMetric | null,
): BreakdownRow[] {
  if (!metric?.headline) {
    return [];
  }

  const usPublicEquitiesPosition = metric.positions?.find(
    (position) => position.comparisonSetType === "us_public_equities",
  );
  const sectorPosition = metric.positions?.find(
    (position) => position.comparisonSetType === "sector",
  );

  return [
    {
      key: "growthRead",
      label: "Growth Read",
      value: metric.headline.interpretationLabel ?? "-",
    },
    {
      key: "growthSummary",
      label: "Growth Summary",
      value: metric.headline.interpretationSummary ?? "-",
    },
    {
      key: "latestGrowth",
      label: "Latest Growth",
      value: formatSignalValue(metric.headline.latestGrowthValue),
    },
    {
      key: "durableGrowth",
      label: "Durable Growth",
      value: formatSignalValue(metric.headline.durableGrowthValue),
    },
    {
      key: "consistency",
      label: "Consistency",
      value: formatSignalValue(metric.headline.consistencyValue),
    },
    {
      key: "coverage",
      label: "Coverage",
      value: formatSignalValue(metric.headline.coverageValue),
    },
    {
      key: "acceleration",
      label: "Acceleration",
      value: formatSignalValue(metric.headline.accelerationValue),
    },
    {
      key: "trendDeviation",
      label: "Trend Deviation",
      value: formatSignalValue(metric.headline.trendDeviationValue),
    },
    {
      key: "positionDate",
      label: "Position Date",
      value:
        usPublicEquitiesPosition?.effectiveDate ??
        sectorPosition?.effectiveDate ??
        "-",
    },
    {
      key: "usPublicEquitiesPercentile",
      label: "US Equities Percentile",
      value: formatPercentile(usPublicEquitiesPosition?.percentile ?? null),
    },
    {
      key: "usPublicEquitiesDistance",
      label: "US Equities Distance To Median",
      value: formatSignedSignalValue(
        usPublicEquitiesPosition?.distanceToMedian ?? null,
      ),
    },
    {
      key: "sectorPercentile",
      label: "Sector Percentile",
      value: formatPercentile(sectorPosition?.percentile ?? null),
    },
    {
      key: "sectorDistance",
      label: "Sector Distance To Median",
      value: formatSignedSignalValue(sectorPosition?.distanceToMedian ?? null),
    },
  ];
}
