import type { TickerOverviewFactorMetric } from "@/backend/schemas/tickers/tickerOverview";
import { Panel, Td, Th } from "@/features/tickers/components/TickerDetailPrimitives";
import {
  formatLabel,
  formatModelLabel,
  formatScore,
} from "@/features/tickers/utils/formatters";

export function TickerAllFactorMetricsPanel({
  factorMetrics,
  selectedMetricKey,
  onSelectMetric,
}: {
  factorMetrics: TickerOverviewFactorMetric[];
  selectedMetricKey?: string | null;
  onSelectMetric?: (metricKey: string) => void;
}) {
  return (
    <Panel title="All Factor Metrics">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#c0c0c0]">
              <Th>Factor</Th>
              <Th>Axis</Th>
              <Th>Metric</Th>
              <Th>Model</Th>
              <Th>Score</Th>
              <Th>Effective</Th>
            </tr>
          </thead>
          <tbody>
            {factorMetrics.length > 0 ? (
              factorMetrics.map((item, index) => {
                const isSelected = item.metricKey === selectedMetricKey;

                return (
                  <tr
                    key={`${item.factor}-${item.axis}-${item.metricKey}-${index}`}
                    className={isSelected ? "bg-[#ffffcc] cursor-pointer" : "bg-white cursor-pointer"}
                    onClick={() => onSelectMetric?.(item.metricKey)}
                  >
                    <Td>{formatLabel(item.factor)}</Td>
                    <Td>{formatLabel(item.axis)}</Td>
                    <Td>
                      <span className={isSelected ? "font-bold underline" : undefined}>
                        {formatLabel(item.metricKey)}
                      </span>
                    </Td>
                    <Td>{formatModelLabel(item.model)}</Td>
                    <Td>
                      <span className={isSelected ? "font-bold" : undefined}>
                        {formatScore(item.score)}
                      </span>
                    </Td>
                    <Td>{item.effectiveDate ?? "-"}</Td>
                  </tr>
                );
              })
            ) : (
              <tr className="bg-white">
                <Td colSpan={6}>No factor metrics found.</Td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
