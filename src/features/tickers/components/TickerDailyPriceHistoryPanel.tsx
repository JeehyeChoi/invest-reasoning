"use client";

import { useEffect, useMemo, useState } from "react";

import type { TickerDailyPriceSeries } from "@/shared/tickers/tickerDailyPrices";
import { Panel } from "@/features/tickers/components/TickerDetailPrimitives";
import { SimpleDailyPriceLineChart } from "@/features/tickers/components/charts/SimpleDailyPriceLineChart";
import { fetchTickerDailyPrices } from "@/features/tickers/services/fetchTickerDailyPrices";

type ChartRange = "1Y" | "5Y" | "10Y" | "MAX";
type ViewRange = ChartRange | "METRIC_MAX";

const CHART_RANGES: ChartRange[] = ["1Y", "5Y", "10Y", "MAX"];

export function TickerDailyPriceHistoryPanel({
  ticker,
  defaultStartDate,
}: {
  ticker: string;
  defaultStartDate?: string | null;
}) {
  const [series, setSeries] = useState<TickerDailyPriceSeries | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<ViewRange>("METRIC_MAX");

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        setIsLoading(true);
        setError(null);

        const result = await fetchTickerDailyPrices(ticker);

        if (!isMounted) return;
        setSeries(result);
      } catch (err) {
        if (!isMounted) return;

        const message =
          err instanceof Error ? err.message : "Failed to load daily prices";

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

  const filteredPoints = useMemo(() => {
    if (!series?.points.length) return [];
    if (range === "METRIC_MAX") {
      if (!defaultStartDate) return series.points;

      const points = series.points.filter(
        (point) => new Date(point.date) >= new Date(defaultStartDate),
      );

      return points.length > 1 ? points : series.points;
    }

    if (range === "MAX") return series.points;

    const years = range === "1Y" ? 1 : range === "5Y" ? 5 : 10;
    const latest = new Date(series.points[series.points.length - 1].date);
    const cutoff = new Date(latest);
    cutoff.setFullYear(cutoff.getFullYear() - years);

    const points = series.points.filter((point) => new Date(point.date) >= cutoff);
    return points.length > 1 ? points : series.points;
  }, [series, range, defaultStartDate]);

  return (
    <Panel title="Daily Price History">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs font-bold">
          View Range:{" "}
          <span className="font-mono">
            {range === "METRIC_MAX" ? "Metric MAX" : range}
          </span>
          {range === "METRIC_MAX" && defaultStartDate ? (
            <span className="ml-2 font-mono font-normal">
              from {defaultStartDate}
            </span>
          ) : null}
          {series ? (
            <span className="ml-3 font-mono font-normal">
              {series.provider} / {series.adjustmentPolicy}
            </span>
          ) : null}
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
        <ChartMessage message="Loading daily prices..." />
      ) : error ? (
        <ChartMessage message={error} isError />
      ) : filteredPoints.length === 0 ? (
        <ChartMessage message="No daily price history loaded for this ticker." />
      ) : (
        <SimpleDailyPriceLineChart points={filteredPoints} />
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
