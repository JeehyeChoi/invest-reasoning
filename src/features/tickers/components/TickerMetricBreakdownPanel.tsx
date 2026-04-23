import type { TickerOverviewFactorMetric } from "@/backend/schemas/tickers/tickerOverview";
import { Panel, Td, Th } from "@/features/tickers/components/TickerDetailPrimitives";
import {
  formatLabel,
  formatUnknownMetricValue,
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
                      <Td>{formatUnknownMetricValue(row.value)}</Td>
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
  if (!metric?.metrics) {
    return [];
  }

  const metricOrder = metric.display?.metricOrder ?? Object.keys(metric.metrics);
  const metricLabels = metric.display?.metricLabels ?? {};

  return metricOrder
    .filter((key) => key in metric.metrics!)
    .map((key) => ({
      key,
      label: metricLabels[key] ?? formatLabel(key),
      value: metric.metrics?.[key],
    }));
}

