"use client";

import { useEffect, useMemo, useState } from "react";

import {
  isSecMetricKey,
  type SecMetricKey,
} from "@/backend/schemas/sec/metrics";
import type { TickerOverviewFactorMetric } from "@/backend/schemas/tickers/tickerOverview";
import type { TickerMetricSeries } from "@/backend/schemas/tickers/tickerMetricSeries";
import { Panel } from "@/features/tickers/components/TickerDetailPrimitives";
import { SimpleQuarterlyBarChart } from "@/features/tickers/components/charts/SimpleQuarterlyBarChart";
import { filterPointsByRange } from "@/features/tickers/components/charts/chartUtils";
import { fetchTickerMetricSeries } from "@/features/tickers/services/fetchTickerMetricSeries";
import { formatLabel } from "@/features/tickers/utils/formatters";

type ChartRange = "3Y" | "5Y" | "10Y" | "MAX";

const CHART_RANGES: ChartRange[] = ["3Y", "5Y", "10Y", "MAX"];

export function TickerHeadlineChartPanel({
  ticker,
  metric,
}: {
  ticker: string;
  metric: TickerOverviewFactorMetric | null;
}) {
  const [series, setSeries] = useState<TickerMetricSeries | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<ChartRange>("5Y");

  const chartMetricKey: SecMetricKey | null = useMemo(() => {
    const candidate = metric?.display?.chart?.metricKey ?? metric?.metricKey ?? null;

    if (!candidate) {
      return null;
    }

    return isSecMetricKey(candidate) ? candidate : null;
  }, [metric]);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      if (!chartMetricKey) {
        setSeries(null);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const result = await fetchTickerMetricSeries(ticker, chartMetricKey);

        if (!isMounted) return;
        setSeries(result);
      } catch (err) {
        if (!isMounted) return;

        const message =
          err instanceof Error ? err.message : "Failed to load metric series";

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
  }, [ticker, chartMetricKey]);

  const title = useMemo(() => {
    if (chartMetricKey) {
      return `Metric Trend (${formatLabel(chartMetricKey)})`;
    }

    return "Metric Trend";
  }, [chartMetricKey]);

  const filteredPoints = useMemo(() => {
    if (!series?.points?.length) {
      return [];
    }

    return filterPointsByRange(series.points, range);
  }, [series, range]);

  return (
    <Panel title={title}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-xs font-bold">
          View Range: <span className="font-mono">{range}</span>
        </div>

        <div className="flex gap-1">
          {CHART_RANGES.map((option) => {
            const active = option === range;

            return (
              <button
                key={option}
                type="button"
                onClick={() => setRange(option)}
                className={[
                  "border border-black px-2 py-1 text-xs font-bold",
                  active ? "bg-[#000080] text-white" : "bg-[#c0c0c0] text-black",
                ].join(" ")}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <ChartMessage message="Loading chart..." />
      ) : error ? (
        <ChartMessage message={error} isError />
      ) : filteredPoints.length === 0 ? (
        <ChartMessage message="No series data available." />
      ) : (
        <SimpleQuarterlyBarChart points={filteredPoints} range={range} />
      )}
    </Panel>
  );
}

function ChartMessage({
  message,
  isError = false,
}: {
  message: string;
  isError?: boolean;
}) {
  return (
    <div className="flex min-h-[300px] items-center justify-center border border-black bg-white">
      <p className={`font-mono text-sm ${isError ? "text-red-700" : "text-gray-600"}`}>
        {message}
      </p>
    </div>
  );
}
