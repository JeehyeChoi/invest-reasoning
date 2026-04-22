import type { TickerOverviewFactorMetric } from "@/backend/schemas/tickers/tickerOverview";
import { Field, Panel } from "@/features/tickers/components/TickerDetailPrimitives";
import {
  formatLabel,
  formatModelLabel,
  formatScore,
} from "@/features/tickers/utils/formatters";

export function TickerHeadlineMetricPanel({
  metric,
}: {
  metric: TickerOverviewFactorMetric | null;
}) {
  return (
    <Panel title="Headline Metric">
      {metric ? (
        <div className="grid gap-3">
          <Field label="Factor" value={formatLabel(metric.factor)} />
          <Field label="Axis" value={formatLabel(metric.axis)} />
          <Field label="Metric" value={formatLabel(metric.metricKey)} />
          <Field label="Model" value={formatModelLabel(metric.model)} />
          <Field label="Effective Date" value={metric.effectiveDate ?? "-"} />
          <Field
            label="Score"
            value={formatScore(metric.score)}
            valueClassName="font-bold"
          />
        </div>
      ) : (
        <p className="font-mono text-sm">No factor metrics available.</p>
      )}
    </Panel>
  );
}
