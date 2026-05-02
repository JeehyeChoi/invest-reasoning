import type { TickerOverviewFactorMetric } from "@/shared/tickers/tickerOverview";
import { Panel, Td, Th } from "@/features/tickers/components/TickerDetailPrimitives";
import {
  formatLabel,
  formatPercentile,
  formatSignalValue,
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
    <Panel title="Metric Signal Headlines">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#c0c0c0]">
              <Th>Metric</Th>
              <Th>Read</Th>
              <Th>Primary</Th>
              <Th>Latest</Th>
              <Th>Durable</Th>
              <Th>Consistency</Th>
              <Th>US Equities %ile</Th>
              <Th>Sector %ile</Th>
              <Th>Quality</Th>
            </tr>
          </thead>
          <tbody>
            {factorMetrics.length > 0 ? (
              factorMetrics.map((item, index) => {
                const isSelected = item.metricKey === selectedMetricKey;
                const headline = item.headline;
                const usPublicEquitiesPosition = item.positions?.find(
                  (position) =>
                    position.comparisonSetType === "us_public_equities",
                );
                const sectorPosition = item.positions?.find(
                  (position) => position.comparisonSetType === "sector",
                );

                return (
                  <tr
                    key={`${item.factor}-${item.axis}-${item.metricKey}-${index}`}
                    className={isSelected ? "bg-[#ffffcc] cursor-pointer" : "bg-white cursor-pointer"}
                    onClick={() => onSelectMetric?.(item.metricKey)}
                  >
                    <Td>
                      <span className={isSelected ? "font-bold underline" : undefined}>
                        {formatLabel(item.metricKey)}
                      </span>
                    </Td>
                    <Td>{headline?.interpretationLabel ?? "-"}</Td>
                    <Td>{formatLabel(headline?.primarySignalKey ?? "-")}</Td>
                    <Td>{formatSignalValue(headline?.latestGrowthValue ?? null)}</Td>
                    <Td>
                      <span className={isSelected ? "font-bold" : undefined}>
                        {formatSignalValue(headline?.durableGrowthValue ?? null)}
                      </span>
                    </Td>
                    <Td>{formatSignalValue(headline?.consistencyValue ?? null)}</Td>
                    <Td>
                      {formatPercentile(
                        usPublicEquitiesPosition?.percentile ?? null,
                      )}
                    </Td>
                    <Td>{formatPercentile(sectorPosition?.percentile ?? null)}</Td>
                    <Td>{formatLabel(headline?.dataQualityLevel ?? "-")}</Td>
                  </tr>
                );
              })
            ) : (
              <tr className="bg-white">
                <Td colSpan={9}>No signal headlines found.</Td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
