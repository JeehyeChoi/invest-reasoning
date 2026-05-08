"use client";

import { useMemo, useState } from "react";

import type { TickerDailyPricePoint } from "@/shared/tickers/tickerDailyPrices";

export function SimpleDailyPriceLineChart({
  points,
}: {
  points: TickerDailyPricePoint[];
}) {
  const width = 900;
  const height = 320;
  const paddingLeft = 64;
  const paddingRight = 24;
  const paddingTop = 20;
  const paddingBottom = 46;
  const volumeBandHeight = 54;
  const volumeGap = 14;
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const chart = useMemo(() => {
    const sampledPoints = samplePoints(points, 620);
    const closes = sampledPoints.map((point) => point.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const valueRange = max - min || 1;
    const innerWidth = width - paddingLeft - paddingRight;
    const priceBottom = height - paddingBottom - volumeBandHeight - volumeGap;
    const volumeTop = priceBottom + volumeGap;
    const volumeBottom = height - paddingBottom;
    const innerHeight = priceBottom - paddingTop;
    const minTime = new Date(sampledPoints[0].date).getTime();
    const maxTime = new Date(sampledPoints[sampledPoints.length - 1].date).getTime();
    const timeRange = Math.max(maxTime - minTime, 1);
    const maxVolume = Math.max(
      ...sampledPoints.map((point) => point.volume ?? 0),
      1,
    );

    const linePoints = sampledPoints.map((point, index) => {
      const time = new Date(point.date).getTime();
      const x = paddingLeft + ((time - minTime) / timeRange) * innerWidth;
      const y =
        priceBottom -
        ((point.close - min) / valueRange) * innerHeight;
      const volume = point.volume ?? 0;
      const volumeHeight = (volume / maxVolume) * volumeBandHeight;

      return {
        x,
        y,
        volumeY: volumeBottom - volumeHeight,
        volumeHeight,
        index,
        point,
      };
    });

    const yTickLines = Array.from({ length: 5 }, (_, index) => {
      const ratio = index / 4;
      const value = max - ratio * valueRange;
      const y =
        priceBottom -
        ((value - min) / valueRange) * innerHeight;

      return { y, value };
    });

    return {
      sampledPoints,
      linePoints,
      path: linePoints
        .map((point, index) =>
          `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
        )
        .join(" "),
      yTickLines,
      xTicks: buildYearTicks(minTime, maxTime, paddingLeft, innerWidth),
      barWidth: Math.max(1, Math.min(4, innerWidth / sampledPoints.length)),
      priceBottom,
      volumeTop,
      volumeBottom,
      maxVolume,
      first: sampledPoints[0],
      latest: sampledPoints[sampledPoints.length - 1],
      min,
      max,
    };
  }, [points]);

  const hovered = hoveredIndex === null ? null : chart.linePoints[hoveredIndex];

  return (
    <div className="border border-black bg-white p-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[320px] w-full">
        {chart.yTickLines.map((tick, index) => (
          <g key={index}>
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
              {formatPrice(tick.value)}
            </text>
          </g>
        ))}

        <line
          x1={paddingLeft}
          x2={paddingLeft}
          y1={paddingTop}
          y2={chart.volumeBottom}
          stroke="black"
          strokeWidth="1"
        />
        <line
          x1={paddingLeft}
          x2={width - paddingRight}
          y1={chart.priceBottom}
          y2={chart.priceBottom}
          stroke="black"
          strokeWidth="1"
        />
        <line
          x1={paddingLeft}
          x2={width - paddingRight}
          y1={chart.volumeBottom}
          y2={chart.volumeBottom}
          stroke="black"
          strokeWidth="1"
        />
        <text
          x={paddingLeft - 10}
          y={chart.volumeTop + 12}
          textAnchor="end"
          fontSize="11"
          fill="#4b5563"
        >
          VOL
        </text>

        {chart.linePoints.map((point, index) => (
          <rect
            key={`${point.point.date}-volume-${index}`}
            x={point.x - chart.barWidth / 2}
            y={point.volumeY}
            width={chart.barWidth}
            height={Math.max(1, point.volumeHeight)}
            fill="#9ca3af"
            opacity="0.75"
          />
        ))}

        <path d={chart.path} fill="none" stroke="#000080" strokeWidth="2" />

        {chart.xTicks.map((tick) => (
          <g key={tick.label}>
            <line
              x1={tick.x}
              x2={tick.x}
              y1={height - paddingBottom}
              y2={height - paddingBottom + 5}
              stroke="black"
            />
            <text
              x={tick.x}
              y={height - 18}
              textAnchor="middle"
              fontSize="11"
              fill="black"
            >
              {tick.label}
            </text>
          </g>
        ))}

        {chart.linePoints.map((point, index) => (
          <circle
            key={`${point.point.date}-${index}`}
            cx={point.x}
            cy={point.y}
            r={7}
            fill="transparent"
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          />
        ))}

        {hovered ? (
          <g>
            <line
              x1={hovered.x}
              x2={hovered.x}
              y1={paddingTop}
              y2={chart.volumeBottom}
              stroke="#808080"
              strokeDasharray="4 3"
            />
            <circle cx={hovered.x} cy={hovered.y} r={4} fill="#000080" />
            <rect
              x={Math.min(hovered.x + 10, width - 190)}
              y={Math.max(10, hovered.y - 50)}
              width="180"
              height="68"
              fill="#ffffe1"
              stroke="black"
            />
            <text
              x={Math.min(hovered.x + 20, width - 180)}
              y={Math.max(30, hovered.y - 30)}
              fontSize="12"
              fontWeight="700"
              fill="black"
            >
              {hovered.point.date}
            </text>
            <text
              x={Math.min(hovered.x + 20, width - 180)}
              y={Math.max(46, hovered.y - 14)}
              fontSize="12"
              fill="black"
            >
              Close {formatPrice(hovered.point.close)}
            </text>
            <text
              x={Math.min(hovered.x + 20, width - 180)}
              y={Math.max(62, hovered.y + 2)}
              fontSize="12"
              fill="black"
            >
              Vol {formatVolume(hovered.point.volume)}
            </text>
          </g>
        ) : null}
      </svg>

      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 border-t border-black pt-2 font-mono text-xs">
        <span>FIRST {chart.first.date}: {formatPrice(chart.first.close)}</span>
        <span>LATEST {chart.latest.date}: {formatPrice(chart.latest.close)}</span>
        <span>MIN {formatPrice(chart.min)}</span>
        <span>MAX {formatPrice(chart.max)}</span>
        <span>MAX VOL {formatVolume(chart.maxVolume)}</span>
        <span>POINTS {points.length}</span>
      </div>
    </div>
  );
}

function samplePoints(
  points: TickerDailyPricePoint[],
  maxPoints: number,
): TickerDailyPricePoint[] {
  if (points.length <= maxPoints) {
    return points;
  }

  const step = Math.ceil(points.length / maxPoints);
  const sampled = points.filter((_, index) => index % step === 0);
  const latest = points[points.length - 1];

  if (sampled[sampled.length - 1]?.date !== latest.date) {
    sampled.push(latest);
  }

  return sampled;
}

function buildYearTicks(
  minTime: number,
  maxTime: number,
  paddingLeft: number,
  innerWidth: number,
) {
  const startYear = new Date(minTime).getFullYear();
  const endYear = new Date(maxTime).getFullYear();
  const interval = endYear - startYear > 15 ? 5 : 1;
  const timeRange = Math.max(maxTime - minTime, 1);
  const ticks: Array<{ x: number; label: string }> = [];

  for (let year = startYear; year <= endYear; year += interval) {
    const time = new Date(`${year}-01-01T00:00:00Z`).getTime();
    const x = paddingLeft + ((time - minTime) / timeRange) * innerWidth;

    if (x >= paddingLeft && x <= paddingLeft + innerWidth) {
      ticks.push({ x, label: String(year) });
    }
  }

  return ticks;
}

function formatPrice(value: number): string {
  return `$${value.toFixed(value >= 100 ? 0 : 2)}`;
}

function formatVolume(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "-";

  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  }

  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }

  return value.toFixed(0);
}
