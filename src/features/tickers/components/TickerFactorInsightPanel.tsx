import type { TickerOverviewFactorMetric } from "@/shared/tickers/tickerOverview";
import { Field, Panel } from "@/features/tickers/components/TickerDetailPrimitives";
import {
  formatFeatureValue,
  formatLabel,
} from "@/features/tickers/utils/formatters";

export function TickerFactorInsightPanel({
  metric,
}: {
  metric: TickerOverviewFactorMetric | null;
}) {
  const insight = metric?.factorInsight ?? null;
  const supportingEvidence = insight?.supportingEvidence ?? [];

  return (
    <Panel title="Factor Insight">
      {metric && insight ? (
        <div className="grid gap-3">
          <Field
            label="Signal"
            value={insight.signalLabel ?? formatLabel(insight.signalKey ?? "-")}
            valueClassName="font-bold"
          />
          <Field
            label="Signal Value"
            value={formatFeatureValue(insight.signalValue)}
          />
          <Field
            label="Confidence"
            value={formatFeatureValue(insight.signalConfidence)}
          />
          <Field label="Factor" value={formatLabel(metric.factor)} />
          <Field label="Metric" value={formatLabel(metric.metricKey)} />
          <Field
            label="Primary Feature"
            value={`${formatLabel(insight.primaryFeatureKey ?? "-")} ${formatFeatureValue(insight.primaryFeatureValue)}`}
          />
          <Field
            label="Observed Metrics"
            value={`${insight.observedMetricCount ?? 0}/${insight.totalMetricCount ?? 0}`}
          />
          <Field
            label="As Of"
            value={insight.signalEffectiveDate ?? "-"}
          />
          {supportingEvidence.length > 0 ? (
            <div className="border-t border-[#808080] pt-3">
              <div className="mb-2 font-mono text-xs uppercase">Evidence</div>
              <div className="grid gap-1">
                {supportingEvidence.map((evidence) => (
                  <div
                    key={`${evidence.metricKey}-${evidence.featureKey}-${evidence.periodEnd}`}
                    className="font-mono text-sm"
                  >
                    {formatLabel(evidence.metricKey)} /{" "}
                    {formatLabel(evidence.featureKey)}:{" "}
                    {formatFeatureValue(evidence.featureValue)}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="font-mono text-sm">No factor insight available.</p>
      )}
    </Panel>
  );
}
