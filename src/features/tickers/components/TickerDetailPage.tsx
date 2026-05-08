"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { TickerOverview } from "@/shared/tickers/tickerOverview";
import {
  StatusRow,
  WindowFrame,
  Panel,
} from "@/features/tickers/components/TickerDetailPrimitives";
import { TickerHeaderPanel } from "@/features/tickers/components/TickerHeaderPanel";
import { TickerFactorInsightPanel } from "@/features/tickers/components/TickerFactorInsightPanel";
import { TickerMetricTrendChartPanel } from "@/features/tickers/components/TickerMetricTrendChartPanel";
import { TickerDailyPriceHistoryPanel } from "@/features/tickers/components/TickerDailyPriceHistoryPanel";
import { TickerVectorPreviewPanel } from "@/features/tickers/components/TickerVectorPreviewPanel";
import { TickerAllFactorMetricsPanel } from "@/features/tickers/components/TickerAllFactorMetricsPanel";
import { fetchTickerOverview } from "@/features/tickers/services/fetchTickerOverview";
import { pickFactorInsightMetric } from "@/features/tickers/utils/pickFactorInsightMetric";

type Props = {
  ticker: string;
};

export function TickerDetailPage({ ticker }: Props) {
  const [data, setData] = useState<TickerOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetricId, setSelectedMetricId] = useState<string | null>(null);
  const [metricMaxWindowStartDate, setMetricMaxWindowStartDate] = useState<
    string | null
  >(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        setIsLoading(true);
        setError(null);

        const result = await fetchTickerOverview(ticker);

        if (!isMounted) return;
        setData(result);
      } catch (err) {
        if (!isMounted) return;

        const message =
          err instanceof Error ? err.message : "Failed to load ticker overview";

        setError(message);
      } finally {
        if (!isMounted) return;
        setIsLoading(false);
      }
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, [ticker]);

  const title = useMemo(() => ticker.toUpperCase(), [ticker]);
  const isFundLike = Boolean(data?.company?.isEtf || data?.company?.isFund);

  const insightMetric = useMemo(() => {
    if (!data) return null;
    return pickFactorInsightMetric(data.factorMetrics);
  }, [data]);

  useEffect(() => {
    if (!insightMetric?.metricKey) {
      setSelectedMetricId(null);
      return;
    }

    setSelectedMetricId(
      (current) => current ?? buildFactorMetricDefaultSelectionId(insightMetric),
    );
  }, [insightMetric]);

  const selectedMetric = useMemo(() => {
    if (!data) return null;
    if (!selectedMetricId) return insightMetric;

    return (
      data.factorMetrics.find(
        (metric) =>
          buildFactorMetricId(metric) ===
          getMetricIdFromSelectionId(selectedMetricId),
      ) ??
      insightMetric
    );
  }, [data, selectedMetricId, insightMetric]);

  const handleMetricMaxWindowChange = useCallback(
    (window: { startDate: string | null; endDate: string | null }) => {
      setMetricMaxWindowStartDate(window.startDate);
    },
    [],
  );

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#008080] p-4 text-black">
        <WindowFrame title={`${title} — Overview`}>
          <div className="space-y-3">
            <StatusRow label="System" value="Loading ticker overview..." />
            <Panel>
              <p className="font-mono text-sm">Fetching market workstation data...</p>
            </Panel>
          </div>
        </WindowFrame>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-[#008080] p-4 text-black">
        <WindowFrame title={`${title} — Overview`}>
          <Panel>
            <p className="font-bold">Load Error</p>
            <p className="mt-2 font-mono text-sm">{error ?? "Ticker not found"}</p>
          </Panel>
        </WindowFrame>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#008080] p-4 text-black">
      <WindowFrame title={`${data.ticker} — Overview`}>
        <div className="grid gap-4">
          <section className={isFundLike ? "grid gap-4" : "grid gap-4 lg:grid-cols-[1.2fr_0.8fr]"}>
            <TickerHeaderPanel ticker={data.ticker} company={data.company} />
            {!isFundLike ? <TickerFactorInsightPanel metric={insightMetric} /> : null}
          </section>

          <section className={isFundLike ? "grid items-start gap-4" : "grid items-start gap-4 lg:grid-cols-2"}>
            {!isFundLike ? (
              <TickerMetricTrendChartPanel
                ticker={data.ticker}
                metric={selectedMetric}
                selectedFeatureKey={getFeatureKeyFromSelectionId(selectedMetricId)}
                onMaxWindowChange={handleMetricMaxWindowChange}
              />
            ) : null}
            <TickerDailyPriceHistoryPanel
              ticker={data.ticker}
              defaultStartDate={isFundLike ? null : metricMaxWindowStartDate}
            />
          </section>

          {!isFundLike ? (
            <section className="grid items-start gap-4 xl:grid-cols-[minmax(420px,0.9fr)_minmax(0,1.1fr)]">
              <TickerVectorPreviewPanel
                ticker={data.ticker}
                factorSignals={data.factorSignals}
                factorMetrics={data.factorMetrics}
              />
              <TickerAllFactorMetricsPanel
                factorMetrics={data.factorMetrics}
                selectedFeatureId={selectedMetricId}
                onSelectMetric={setSelectedMetricId}
              />
            </section>
          ) : null}

          <div className="border border-black bg-[#c0c0c0] px-2 py-1 text-xs">
            <span className="font-mono">
              STATUS: READY | TICKER={data.ticker} | METRICS={data.factorMetrics.length}
              {isFundLike ? " | INSTRUMENT=FUND" : ""}
              {selectedMetric?.metricKey
                ? ` | SELECTED=${selectedMetric.metricKey}`
                : ""}
              {getFeatureKeyFromSelectionId(selectedMetricId)
                ? ` | FEATURE=${getFeatureKeyFromSelectionId(selectedMetricId)}`
                : ""}
            </span>
          </div>
        </div>
      </WindowFrame>
    </main>
  );
}

function buildFactorMetricId(
  metric: TickerOverview["factorMetrics"][number],
): string {
  return `${metric.factor}:${metric.axis}:${metric.metricKey}`;
}

function buildFactorMetricDefaultSelectionId(
  metric: TickerOverview["factorMetrics"][number],
): string {
  const metricId = buildFactorMetricId(metric);
  const primaryFeatureKey = metric.factorInsight?.primaryFeatureKey;
  const features = metric.features ?? [];
  const selectedFeature =
    features.find((feature) => feature.featureKey === primaryFeatureKey) ??
    features[0];

  return selectedFeature ? `${metricId}:${selectedFeature.featureKey}` : metricId;
}

function getMetricIdFromSelectionId(selectionId: string | null): string | null {
  if (!selectionId) return null;

  return selectionId.split(":").slice(0, 3).join(":");
}

function getFeatureKeyFromSelectionId(selectionId: string | null): string | null {
  if (!selectionId) return null;

  const parts = selectionId.split(":");
  return parts.length > 3 ? parts.slice(3).join(":") : null;
}
