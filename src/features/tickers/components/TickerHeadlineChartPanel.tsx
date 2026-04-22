"use client";

import { useEffect, useMemo, useState } from "react";

import {
  isSecMetricKey,
  type SecMetricKey,
} from "@/backend/schemas/sec/metrics";
import type { TickerOverviewFactorMetric } from "@/backend/schemas/tickers/tickerOverview";
import type { TickerMetricSeries } from "@/backend/schemas/tickers/tickerMetricSeries";
import { Panel } from "@/features/tickers/components/TickerDetailPrimitives";
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
    if (metric?.display?.chart?.title) {
      return `Headline Metric Trend (${formatLabel(chartMetricKey ?? metric.metricKey)})`;
    }

    if (chartMetricKey) {
      return `Headline Metric Trend (${formatLabel(chartMetricKey)})`;
    }

    return "Headline Metric Trend";
  }, [metric, chartMetricKey]);

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

function SimpleQuarterlyBarChart({
  points,
  range,
}: {
  points: TickerMetricSeries["points"];
  range: ChartRange;
}) {
  const width = 820;
  const height = 320;
  const paddingLeft = 72;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 48;

  const values = points.map((p) => p.val);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const yMin = Math.min(0, min);
  const yMax = max;
  const valueRange = yMax - yMin || 1;

  const innerWidth = width - paddingLeft - paddingRight;
  const innerHeight = height - paddingTop - paddingBottom;
  const barSlotWidth = innerWidth / Math.max(points.length, 1);
  const barWidth = Math.max(4, Math.min(18, barSlotWidth * 0.7));

	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const bars = points.map((point, index) => {
    const centerX = paddingLeft + index * barSlotWidth + barSlotWidth / 2;
    const x = centerX - barWidth / 2;

    const zeroY =
      height -
      paddingBottom -
      ((0 - yMin) / valueRange) * innerHeight;

    const valueY =
      height -
      paddingBottom -
      ((point.val - yMin) / valueRange) * innerHeight;

    const y = Math.min(zeroY, valueY);
    const barHeight = Math.max(1, Math.abs(zeroY - valueY));

    return {
      x,
      y,
      width: barWidth,
      height: barHeight,
      centerX,
      point,
    };
  });

  const yTicks = 4;
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) => {
    const ratio = i / yTicks;
    return yMax - ratio * valueRange;
  });

  const yTickLines = yTickValues.map((tickValue) => {
    const y =
      height -
      paddingBottom -
      ((tickValue - yMin) / valueRange) * innerHeight;

    return { y, value: tickValue };
  });

  const zeroLineY =
    height -
    paddingBottom -
    ((0 - yMin) / valueRange) * innerHeight;

	const xTicks = buildYearlyXAxisTicks(points, bars);

  const latest = points[points.length - 1];
  const first = points[0];

	const hoveredPoint =
		hoveredIndex != null ? points[hoveredIndex] : null;
	const hoveredBar =
		hoveredIndex != null ? bars[hoveredIndex] : null;

  return (
    <div className="border border-black bg-white p-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[320px] w-full">
        {yTickLines.map((tick, i) => (
          <g key={i}>
            <line
              x1={paddingLeft}
              x2={width - paddingRight}
              y1={tick.y}
              y2={tick.y}
              stroke="#d1d5db"
              strokeWidth="1"
            />
            <text
              x={paddingLeft - 10}
              y={tick.y + 4}
              textAnchor="end"
              fontSize="12"
              fill="black"
            >
              {formatAxisValue(tick.value)}
            </text>
          </g>
        ))}

        <line
          x1={paddingLeft}
          x2={paddingLeft}
          y1={paddingTop}
          y2={height - paddingBottom}
          stroke="black"
          strokeWidth="1"
        />
        <line
          x1={paddingLeft}
          x2={width - paddingRight}
          y1={zeroLineY}
          y2={zeroLineY}
          stroke="black"
          strokeWidth="1"
        />

				{bars.map((bar, index) => (
					<rect
						key={`${bar.point.end}-${index}`}
						x={bar.x}
						y={bar.y}
						width={bar.width}
						height={bar.height}
						fill={index === bars.length - 1 ? "#000080" : "#808080"}
						stroke="black"
						strokeWidth="1"
						onMouseEnter={() => setHoveredIndex(index)}
						onMouseLeave={() => setHoveredIndex(null)}
					/>
				))}

        {xTicks.map((tick, i) => (
          <g key={i}>
            <line
              x1={tick.x}
              x2={tick.x}
              y1={height - paddingBottom}
              y2={height - paddingBottom + 6}
              stroke="black"
              strokeWidth="1"
            />
            <text
              x={tick.x}
              y={height - paddingBottom + 22}
              textAnchor="middle"
              fontSize="13"
              fill="black"
            >
              {tick.label}
            </text>
          </g>
        ))}

				{hoveredPoint && hoveredBar && (
					<g>
						<rect
							x={Math.max(12, hoveredBar.centerX - 90)}
							y={28}
							width={180}
							height={54}
							fill="white"
							stroke="black"
							strokeWidth="1"
						/>
						<text
							x={Math.max(20, hoveredBar.centerX - 82)}
							y={46}
							fontSize="12"
							fill="black"
						>
							{hoveredPoint.displayFrame ?? formatQuarterLabel(hoveredPoint.end)}
						</text>
						<text
							x={Math.max(20, hoveredBar.centerX - 82)}
							y={62}
							fontSize="11"
							fill="black"
						>
							{formatDateRange(hoveredPoint)}
						</text>
						<text
							x={Math.max(20, hoveredBar.centerX - 82)}
							y={78}
							fontSize="11"
							fill="black"
						>
							{formatAxisValue(hoveredPoint.val)}
						</text>
					</g>
				)}
				
      </svg>

      <div className="mt-3 grid gap-1 text-xs sm:grid-cols-2 lg:grid-cols-4">
				<ChartStat label="Start" value={first.displayFrame ?? formatQuarterLabel(first.end)} />
				<ChartStat label="Latest" value={latest.displayFrame ?? formatQuarterLabel(latest.end)} />
        <ChartStat label="Latest Value" value={formatAxisValue(latest.val)} />
        <ChartStat
          label="Range"
          value={`${formatAxisValue(min)} → ${formatAxisValue(max)}`}
        />
      </div>
    </div>
  );
}

function ChartStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="border border-black bg-[#c0c0c0] px-2 py-1">
      <div className="font-bold">{label}</div>
      <div className="font-mono">{value}</div>
    </div>
  );
}

function filterPointsByRange(
  points: TickerMetricSeries["points"],
  range: ChartRange,
): TickerMetricSeries["points"] {
  if (range === "MAX") {
    return points;
  }

  const years = range === "3Y" ? 3 : range === "5Y" ? 5 : 10;
  const latestDate = new Date(points[points.length - 1].end);
  const cutoff = new Date(latestDate);
  cutoff.setFullYear(cutoff.getFullYear() - years);

  const filtered = points.filter((point) => new Date(point.end) >= cutoff);

  return filtered.length > 1 ? filtered : points;
}

function buildYearlyXAxisTicks(
  points: TickerMetricSeries["points"],
  bars: Array<{ centerX: number }>,
) {
  const ticks: Array<{ x: number; label: string }> = [];
  const seenYears = new Set<string>();

  points.forEach((point, index) => {
    const year = String(new Date(point.end).getFullYear());

    if (seenYears.has(year)) {
      return;
    }

    seenYears.add(year);

    ticks.push({
      x: bars[index]?.centerX ?? 0,
      label: year,
    });
  });

  return ticks;
}

function formatQuarterLabel(dateString: string): string {
  const date = new Date(dateString);
  const year = String(date.getFullYear()).slice(2);
  const month = date.getMonth() + 1;

  const quarter =
    month <= 3 ? "Q1" : month <= 6 ? "Q2" : month <= 9 ? "Q3" : "Q4";

  return `${year}${quarter}`;
}

function formatDateRange(point: { start?: string | null; end: string }): string {
  if (!point.start) {
    return point.end;
  }

  return `${point.start} → ${point.end}`;
}

function formatAxisValue(value: number): string {
  if (!Number.isFinite(value)) {
    return "-";
  }

  if (Math.abs(value) >= 1_000_000_000_000) {
    return `${(value / 1_000_000_000_000).toFixed(1)}T`;
  }

  if (Math.abs(value) >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  }

  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }

  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }

  return value.toFixed(0);
}

