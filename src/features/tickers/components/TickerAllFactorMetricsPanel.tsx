import type { TickerOverviewFactorMetric } from "@/shared/tickers/tickerOverview";
import { Panel, Td, Th } from "@/features/tickers/components/TickerDetailPrimitives";
import {
  formatFeatureValue,
  formatLabel,
} from "@/features/tickers/utils/formatters";

export function TickerAllFactorMetricsPanel({
  factorMetrics,
  selectedFeatureId,
  onSelectMetric,
}: {
  factorMetrics: TickerOverviewFactorMetric[];
  selectedFeatureId?: string | null;
  onSelectMetric?: (metricId: string) => void;
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
              <Th>Role</Th>
              <Th>Feature Values</Th>
            </tr>
          </thead>
          <tbody>
            {factorMetrics.length > 0 ? (
              factorMetrics.map((item, index) => {
                const metricId = buildFactorMetricId(item);
                const isSelected =
                  metricId === getMetricIdFromSelectionId(selectedFeatureId);
                const features = item.features ?? [];

                return (
                  <tr
                    key={`${item.factor}-${item.axis}-${item.metricKey}-${index}`}
                    className={isSelected ? "bg-[#ffffcc] cursor-pointer" : "bg-white cursor-pointer"}
                    onClick={() => onSelectMetric?.(metricId)}
                  >
                    <Td>{formatLabel(item.factor)}</Td>
                    <Td>{formatLabel(item.axis)}</Td>
                    <Td>
                      <span className={isSelected ? "font-bold underline" : undefined}>
                        {formatLabel(item.metricKey)}
                      </span>
                    </Td>
                    <Td>{formatLabel(item.metricRole)}</Td>
                    <Td>
                      <FeatureValueList
                        features={features}
                        missingFeatureMessage={item.missingFeatureMessage}
                        metricId={metricId}
                        selectedFeatureId={selectedFeatureId}
                        onSelectMetric={onSelectMetric}
                      />
                    </Td>
                  </tr>
                );
              })
            ) : (
              <tr className="bg-white">
                <Td colSpan={5}>No factor metrics found.</Td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function buildFactorMetricId(metric: TickerOverviewFactorMetric): string {
  return `${metric.factor}:${metric.axis}:${metric.metricKey}`;
}

function getMetricIdFromSelectionId(selectionId?: string | null): string | null {
  if (!selectionId) return null;

  return selectionId.split(":").slice(0, 3).join(":");
}

function buildFactorMetricFeatureId(input: {
  metricId: string;
  featureKey: string;
}): string {
  return `${input.metricId}:${input.featureKey}`;
}

function FeatureValueList({
  features,
  missingFeatureMessage,
  metricId,
  selectedFeatureId,
  onSelectMetric,
}: {
  features: NonNullable<TickerOverviewFactorMetric["features"]>;
  missingFeatureMessage?: string | null;
  metricId: string;
  selectedFeatureId?: string | null;
  onSelectMetric?: (metricId: string) => void;
}) {
  if (features.length === 0) {
    return missingFeatureMessage ? (
      <span className="text-xs font-bold text-[#800000]">
        {missingFeatureMessage}
      </span>
    ) : (
      <>-</>
    );
  }

  return (
    <div className="grid gap-1">
      {features.map((feature) => {
        const featureId = buildFactorMetricFeatureId({
          metricId,
          featureKey: feature.featureKey,
        });
        const isSelected = featureId === selectedFeatureId;

        return (
          <button
            key={feature.featureKey}
            type="button"
            className={[
              "grid grid-cols-[minmax(160px,1fr)_auto] gap-3 border border-transparent px-1 py-0.5 text-left",
              isSelected ? "border-black bg-[#ffffcc] font-bold" : "bg-white",
            ].join(" ")}
            onClick={(event) => {
              event.stopPropagation();
              onSelectMetric?.(featureId);
            }}
          >
            <span>{feature.featureLabel}</span>
            <span className="font-mono">
              {formatFeatureValue(feature.featureValue)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
