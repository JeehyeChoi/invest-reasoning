"use client";

import { useMemo, useState } from "react";

import type { TickerMetricSeries } from "@/shared/tickers/tickerMetricSeries";
import {
  buildYearlyXAxisTicksFromTime,
  formatAxisValue,
  formatBuildSourceKind,
  formatDateRange,
  formatQuarterLabel,
} from "@/features/tickers/components/charts/chartUtils";

export function SimpleQuarterlyBarChart({
  points,
}: {
  points: TickerMetricSeries["points"];
  range: "3Y" | "5Y" | "10Y" | "MAX";
}) {
  const isInstantSeries = points.some((point) => point.periodType === "instant");
  const width = 820;
  const height = 320;
  const paddingLeft = 72;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 48;

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const {
    bars,
    rolling4LinePoints,
    yTickLines,
    zeroLineY,
    latest,
    first,
    min,
    max,
    xTicks,
  } = useMemo(() => {
    const values = points.flatMap((p) =>
      p.rolling4Avg != null && Number.isFinite(p.rolling4Avg)
        ? [p.val, p.rolling4Avg]
        : [p.val],
    );
    const min = Math.min(...values);
    const max = Math.max(...values);
    const yMin = Math.min(0, min);
    const yMax = Math.max(0, max);
    const valueRange = yMax - yMin || 1;

    const innerWidth = width - paddingLeft - paddingRight;
    const innerHeight = height - paddingTop - paddingBottom;

		const startTimes = points.map((p) => {
			if (p.start) {
				return new Date(p.start).getTime();
			}

			const fallbackStart = new Date(p.end);
			fallbackStart.setMonth(fallbackStart.getMonth() - 3);
			fallbackStart.setDate(fallbackStart.getDate() + 1);
			return fallbackStart.getTime();
		});

		const endTimes = points.map((p) => new Date(p.end).getTime());

		const minTime = Math.min(...startTimes);
		const maxTime = Math.max(...endTimes);
		const timeRange = Math.max(maxTime - minTime, 1);

    const zeroLineY =
      height -
      paddingBottom -
      ((0 - yMin) / valueRange) * innerHeight;

		const bars = points.map((point) => {
			const endTime = new Date(point.end).getTime();

			const fallbackStart = new Date(point.end);
			fallbackStart.setMonth(fallbackStart.getMonth() - 3);
			fallbackStart.setDate(fallbackStart.getDate() + 1);

			const startTime = point.start
				? new Date(point.start).getTime()
				: fallbackStart.getTime();

			const startRatio = (startTime - minTime) / timeRange;
			const endRatio = (endTime - minTime) / timeRange;

			const startX = paddingLeft + startRatio * innerWidth;
			const endX = paddingLeft + endRatio * innerWidth;

			const x = startX;
			const rawWidth = endX - startX;
			const width = Math.max(2, rawWidth * 0.7);

			const valueY =
				height -
				paddingBottom -
				((point.val - yMin) / valueRange) * innerHeight;

			const y = Math.min(zeroLineY, valueY);
			const barHeight = Math.max(1, Math.abs(zeroLineY - valueY));

			return {
				x,
				y,
				width,
				height: barHeight,
				centerX: x + width / 2,
				point,
			};
		});

    const rolling4LinePoints = bars
      .map((bar) => {
        const value = bar.point.rolling4Avg;

        if (value == null || !Number.isFinite(value)) {
          return null;
        }

        const y =
          height -
          paddingBottom -
          ((value - yMin) / valueRange) * innerHeight;

        return {
          x: bar.centerX,
          y,
          value,
        };
      })
      .filter((point): point is NonNullable<typeof point> => point !== null);

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

    const xTicks = buildYearlyXAxisTicksFromTime({
      points,
      minTime,
      maxTime,
      paddingLeft,
      innerWidth,
    });

    return {
      bars,
      rolling4LinePoints,
      yTickLines,
      zeroLineY,
      latest: points[points.length - 1],
      first: points[0],
      min,
      max,
      xTicks,
    };
  }, [points]);

  const hoveredPoint = hoveredIndex != null ? points[hoveredIndex] : null;
  const hoveredBar = hoveredIndex != null ? bars[hoveredIndex] : null;
  const hoveredTooltipHeight =
    hoveredPoint?.rolling4Avg != null ? 84 : 68;

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

        {rolling4LinePoints.length >= 2 ? (
          <polyline
            points={rolling4LinePoints
              .map((point) => `${point.x},${point.y}`)
              .join(" ")}
            fill="none"
            stroke="#b45309"
            strokeWidth="2"
            strokeDasharray="6 4"
            strokeLinecap="round"
            strokeLinejoin="round"
            pointerEvents="none"
          />
        ) : null}

        {rolling4LinePoints.map((point, index) => (
          <circle
            key={`rolling4-${index}`}
            cx={point.x}
            cy={point.y}
            r="3"
            fill="white"
            stroke="#b45309"
            strokeWidth="1.5"
            pointerEvents="none"
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
              x={Math.max(12, Math.min(width - 192, hoveredBar.centerX - 90))}
              y={28}
              width={180}
              height={hoveredTooltipHeight}
              fill="white"
              stroke="black"
              strokeWidth="1"
            />
            <text
              x={Math.max(20, Math.min(width - 184, hoveredBar.centerX - 82))}
              y={46}
              fontSize="12"
              fill="black"
            >
              {isInstantSeries
                ? hoveredPoint.end
                : formatQuarterLabel(hoveredPoint.end)}
            </text>
            <text
              x={Math.max(20, Math.min(width - 184, hoveredBar.centerX - 82))}
              y={62}
              fontSize="11"
              fill="black"
            >
              {formatDateRange(hoveredPoint)}
            </text>
            <text
              x={Math.max(20, Math.min(width - 184, hoveredBar.centerX - 82))}
              y={78}
              fontSize="11"
              fill="black"
            >
              {formatAxisValue(hoveredPoint.val)}
            </text>
            <text
              x={Math.max(20, Math.min(width - 184, hoveredBar.centerX - 82))}
              y={94}
              fontSize="10"
              fill="#374151"
            >
              {formatBuildSourceKind(hoveredPoint.buildSourceKind)}
            </text>
            {hoveredPoint.rolling4Avg != null ? (
              <text
                x={Math.max(20, Math.min(width - 184, hoveredBar.centerX - 82))}
                y={108}
                fontSize="10"
                fill="#92400e"
              >
                Rolling 4Q avg: {formatAxisValue(hoveredPoint.rolling4Avg)}
              </text>
            ) : null}
          </g>
        )}
      </svg>

      <div className="mt-2 flex flex-wrap items-center gap-4 border border-black bg-[#c0c0c0] px-2 py-1 text-xs">
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-5 border border-black bg-[#808080]" />
          <span className="font-mono">
            {isInstantSeries ? "snapshot value" : "quarterly value"}
          </span>
        </div>
        {!isInstantSeries ? (
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 48 12" className="h-3 w-12" aria-hidden="true">
              <line
                x1="2"
                x2="46"
                y1="6"
                y2="6"
                stroke="#b45309"
                strokeWidth="2"
                strokeDasharray="6 4"
                strokeLinecap="round"
              />
              <circle
                cx="24"
                cy="6"
                r="3"
                fill="white"
                stroke="#b45309"
                strokeWidth="1.5"
              />
            </svg>
            <span className="font-mono">rolling4 avg</span>
          </div>
        ) : null}
      </div>

      <div className="mt-3 grid gap-1 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <ChartStat
          label={isInstantSeries ? "First Snapshot" : "Start"}
          value={isInstantSeries ? first.end : formatQuarterLabel(first.end)}
        />
        <ChartStat
          label={isInstantSeries ? "Latest Snapshot" : "Latest"}
          value={isInstantSeries ? latest.end : formatQuarterLabel(latest.end)}
        />
        <ChartStat label="Latest Value" value={formatAxisValue(latest.val)} />
        <ChartStat
          label="Range"
          value={`${formatAxisValue(min)} → ${formatAxisValue(max)}`}
        />
        {!isInstantSeries ? (
          <ChartStat
            label="Rolling 4Q Avg"
            value={
              latest.rolling4Avg != null
                ? formatAxisValue(latest.rolling4Avg)
                : "-"
            }
          />
        ) : null}
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
