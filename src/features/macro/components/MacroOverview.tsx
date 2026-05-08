"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Activity, Database, RefreshCw, TrendingUp } from "lucide-react";
import type {
  FredMacroSeriesOverview,
  FredMacroSeriesSummary,
} from "@/shared/macro/fred";
import { fetchFredMacroSeriesOverview } from "@/features/macro/services/fetchFredMacroSeriesOverview";
import {
  WorkstationFrame,
  WorkstationPanel,
} from "@/features/workstation/components/WorkstationChrome";

type PeriodMode = "all" | "1y" | "5y" | "10y" | "20y" | "2000" | "custom";

function formatSeriesValue(
  series: Pick<FredMacroSeriesSummary, "units">,
  value: number | null,
) {
  if (value === null || !Number.isFinite(value)) {
    return "-";
  }

  if (series.units === "lin") {
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 2,
    }).format(value);
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatSeriesDelta(
  series: Pick<FredMacroSeriesSummary, "units">,
  value: number | null,
) {
  if (value === null || !Number.isFinite(value)) {
    return "-";
  }

  if (series.units === "lin") {
    const sign = value > 0 ? "+" : "";
    return `${sign}${new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 2,
    }).format(value)}`;
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)} pp`;
}

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return value;
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function getSeriesDelta(series: FredMacroSeriesSummary) {
  if (series.latestValue === null || series.previousValue === null) {
    return null;
  }

  return series.latestValue - series.previousValue;
}

function subtractYears(dateText: string, years: number) {
  const date = new Date(`${dateText}T00:00:00.000Z`);
  date.setUTCFullYear(date.getUTCFullYear() - years);

  return date.toISOString().slice(0, 10);
}

function filterObservationsByPeriod(
  series: FredMacroSeriesSummary,
  periodMode: PeriodMode,
  customStartDate: string,
  customEndDate: string,
) {
  const observations = series.observations;
  const firstDate = observations[0]?.observationDate ?? "";
  const latestDate =
    observations.at(-1)?.observationDate ?? series.latestObservationDate ?? "";

  let startDate = firstDate;
  let endDate = latestDate;

  if (periodMode === "1y" && latestDate) {
    startDate = subtractYears(latestDate, 1);
  }

  if (periodMode === "5y" && latestDate) {
    startDate = subtractYears(latestDate, 5);
  }

  if (periodMode === "10y" && latestDate) {
    startDate = subtractYears(latestDate, 10);
  }

  if (periodMode === "20y" && latestDate) {
    startDate = subtractYears(latestDate, 20);
  }

  if (periodMode === "2000") {
    startDate = "2000-01-01";
  }

  if (periodMode === "custom") {
    startDate = customStartDate || firstDate;
    endDate = customEndDate || latestDate;
  }

  return observations.filter(
    (observation) =>
      (!startDate || observation.observationDate >= startDate) &&
      (!endDate || observation.observationDate <= endDate),
  );
}

function buildSeriesForObservations(
  series: FredMacroSeriesSummary,
  observations: FredMacroSeriesSummary["observations"],
): FredMacroSeriesSummary {
  const validObservations = observations.filter(
    (observation) => observation.value !== null,
  );
  const latest = validObservations.at(-1) ?? observations.at(-1) ?? null;
  const previous =
    validObservations.length >= 2
      ? validObservations.at(-2) ?? null
      : observations.length >= 2
        ? observations.at(-2) ?? null
        : null;

  return {
    ...series,
    latestObservationDate: latest?.observationDate ?? null,
    latestValue: latest?.value ?? null,
    previousObservationDate: previous?.observationDate ?? null,
    previousValue: previous?.value ?? null,
    observationCount: observations.length,
    observations,
  };
}

function buildPath(points: { x: number; y: number }[]) {
  if (points.length === 0) {
    return "";
  }

  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
}

function buildYearTicks(startDate: Date, endDate: Date) {
  const startYear = startDate.getUTCFullYear();
  const endYear = endDate.getUTCFullYear();
  const yearSpan = Math.max(1, endYear - startYear);
  const step = Math.max(1, Math.ceil(yearSpan / 5));
  const ticks: number[] = [];

  for (let year = startYear; year <= endYear; year += step) {
    ticks.push(year);
  }

  if (ticks.at(-1) !== endYear) {
    ticks.push(endYear);
  }

  return ticks;
}

function buildMonthTicks(startDate: Date, endDate: Date) {
  const ticks: { date: string; label: string }[] = [];
  const cursor = new Date(
    Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1),
  );
  const endMonth = new Date(
    Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1),
  );

  while (cursor <= endMonth) {
    ticks.push({
      date: cursor.toISOString().slice(0, 10),
      label: cursor.toLocaleString("en-US", {
        month: "short",
        timeZone: "UTC",
      }),
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return ticks;
}

function buildYTicks(min: number, max: number) {
  const range = max - min || 1;
  const step = range / 4;

  return Array.from({ length: 5 }, (_, index) => min + step * index);
}

function SeriesSparkline({
  series,
  periodMode,
}: {
  series: FredMacroSeriesSummary;
  periodMode: PeriodMode;
}) {
  const values = series.observations.filter(
    (observation): observation is { observationDate: string; value: number } =>
      observation.value !== null,
  );

  if (values.length < 2) {
    return (
      <div className="flex h-28 items-center justify-center border border-zinc-200 bg-[#f8f8f5] font-mono text-xs uppercase tracking-[0.14em] text-zinc-400">
        no chart data
      </div>
    );
  }

  const chartWidth = 760;
  const chartHeight = 260;
  const padding = {
    top: 18,
    right: 18,
    bottom: 34,
    left: 52,
  };
  const rawMin = Math.min(...values.map((point) => point.value));
  const rawMax = Math.max(...values.map((point) => point.value));
  const rawRange = rawMax - rawMin || 1;
  const min = rawMin - rawRange * 0.08;
  const max = rawMax + rawRange * 0.08;
  const range = max - min || 1;
  const startTime = Date.parse(values[0].observationDate);
  const endTime = Date.parse(values.at(-1)?.observationDate ?? values[0].observationDate);
  const timeRange = endTime - startTime || 1;
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;
  const scaleX = (date: string) =>
    padding.left + ((Date.parse(date) - startTime) / timeRange) * plotWidth;
  const scaleY = (value: number) =>
    padding.top + (1 - (value - min) / range) * plotHeight;
  const points = values.map((point) => ({
    x: scaleX(point.observationDate),
    y: scaleY(point.value),
  }));
  const zeroY =
    min <= 0 && max >= 0
      ? scaleY(0)
      : null;
  const startDate = new Date(values[0].observationDate);
  const endDate = new Date(
    values.at(-1)?.observationDate ?? values[0].observationDate,
  );
  const xTicks =
    periodMode === "1y"
      ? buildMonthTicks(startDate, endDate)
      : buildYearTicks(startDate, endDate).map((year) => ({
          date: `${year}-01-01`,
          label: String(year),
        }));
  const yTicks = buildYTicks(min, max);

  return (
    <div className="border border-zinc-200 bg-[#fbfaf5] px-3 py-3">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="h-64 w-full"
        role="img"
        aria-label={`${series.label} historical trend`}
      >
        {yTicks.map((tick) => {
          const y = scaleY(tick);

          return (
            <g key={tick}>
              <line
                x1={padding.left}
                x2={chartWidth - padding.right}
                y1={y}
                y2={y}
                stroke="#e4e4e7"
              />
              <text
                x={padding.left - 8}
                y={y + 3}
                textAnchor="end"
                className="fill-zinc-500 font-mono text-[10px]"
              >
                {tick.toFixed(1)}
              </text>
            </g>
          );
        })}
        {zeroY !== null ? (
          <line
            x1={padding.left}
            x2={chartWidth - padding.right}
            y1={zeroY}
            y2={zeroY}
            stroke="#a1a1aa"
            strokeDasharray="4 4"
          />
        ) : null}
        {xTicks.map((tick) => {
          const x = scaleX(tick.date);

          return (
            <g key={tick.date}>
              <line
                x1={x}
                x2={x}
                y1={padding.top}
                y2={chartHeight - padding.bottom}
                stroke="#ececef"
              />
              <text
                x={x}
                y={chartHeight - 8}
                textAnchor="middle"
                className="fill-zinc-500 font-mono text-[10px]"
              >
                {tick.label}
              </text>
            </g>
          );
        })}
        <path
          d={buildPath(points)}
          fill="none"
          stroke="#173b35"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((point, index) => {
          if (index !== 0 && index !== points.length - 1) {
            return null;
          }

          return (
            <circle
              key={`${point.x}-${point.y}`}
              cx={point.x}
              cy={point.y}
              r="3"
              fill={index === points.length - 1 ? "#b88a2f" : "#173b35"}
            />
          );
        })}
      </svg>
    </div>
  );
}

function SummaryStat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="border-b border-zinc-200 p-4 sm:border-r sm:border-b-0">
      <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold text-zinc-950">{value}</div>
    </div>
  );
}

export function MacroOverview() {
  const [overview, setOverview] = useState<FredMacroSeriesOverview | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [periodMode, setPeriodMode] = useState<PeriodMode>("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    fetchFredMacroSeriesOverview()
      .then((nextOverview) => {
        if (!isMounted) return;
        setOverview(nextOverview);
        setSelectedKey((currentKey) => currentKey ?? nextOverview.series[0]?.key ?? null);
      })
      .catch((error) => {
        if (!isMounted) return;
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to fetch FRED macro series.",
        );
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const selectedSeries = useMemo(() => {
    if (!overview) {
      return null;
    }

    return (
      overview.series.find((series) => series.key === selectedKey) ??
      overview.series[0] ??
      null
    );
  }, [overview, selectedKey]);

  const selectedSeriesBounds = useMemo(() => {
    const observations = selectedSeries?.observations ?? [];

    return {
      firstDate: observations[0]?.observationDate ?? "",
      latestDate:
        observations.at(-1)?.observationDate ??
        selectedSeries?.latestObservationDate ??
        "",
    };
  }, [selectedSeries]);

  const displaySeries = useMemo(() => {
    if (!selectedSeries) {
      return null;
    }

    const filteredObservations = filterObservationsByPeriod(
      selectedSeries,
      periodMode,
      customStartDate,
      customEndDate,
    );

    return buildSeriesForObservations(selectedSeries, filteredObservations);
  }, [customEndDate, customStartDate, periodMode, selectedSeries]);

  if (errorMessage) {
    return (
      <MacroOverviewShell>
        <WorkstationPanel className="p-6">
          <h1 className="text-lg font-semibold text-zinc-950">
            Failed to load macro data
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">{errorMessage}</p>
        </WorkstationPanel>
      </MacroOverviewShell>
    );
  }

  if (!overview || !selectedSeries || !displaySeries) {
    return (
      <MacroOverviewShell>
        <WorkstationPanel className="p-6">
          <h1 className="text-lg font-semibold text-zinc-950">
            Loading macro data
          </h1>
        </WorkstationPanel>
      </MacroOverviewShell>
    );
  }

  const latestSeries = [...overview.series].sort((a, b) =>
    (b.latestObservationDate ?? "").localeCompare(a.latestObservationDate ?? ""),
  )[0];
  const totalObservations = overview.series.reduce(
    (sum, series) => sum + series.observationCount,
    0,
  );
  const selectedDelta = getSeriesDelta(displaySeries);
  const tableRows = [...displaySeries.observations]
    .reverse()
    .slice(0, 24);
  const periodLabel =
    displaySeries.observations.length > 0
      ? `${displaySeries.observations[0]?.observationDate} - ${
          displaySeries.observations.at(-1)?.observationDate
        }`
      : "No observations";

  return (
    <MacroOverviewShell>
      <section className="border-b border-zinc-300 pb-7">
        <div className="font-mono text-xs font-semibold uppercase tracking-[0.24em] text-[#6d5a2d]">
          Macro Data
        </div>
        <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 md:text-4xl">
              FRED Macro Series
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
              Stored U.S. macro indicators used for signal baselines and macro
              contrast views.
            </p>
          </div>
          <div className="grid min-w-full grid-cols-3 border border-zinc-950 bg-white text-right shadow-[4px_4px_0_0_rgba(24,24,27,0.12)] sm:min-w-[420px]">
            <div className="border-r border-zinc-200 px-3 py-3">
              <div className="text-2xl font-semibold text-zinc-950">
                {overview.series.length}
              </div>
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                series
              </div>
            </div>
            <div className="border-r border-zinc-200 px-3 py-3">
              <div className="text-2xl font-semibold text-zinc-950">
                {totalObservations}
              </div>
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                rows
              </div>
            </div>
            <div className="px-3 py-3">
              <div className="text-2xl font-semibold text-zinc-950">
                {latestSeries?.latestObservationDate ?? "-"}
              </div>
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                latest
              </div>
            </div>
          </div>
        </div>
      </section>

      {overview.unavailableReason ? (
        <section className="mt-6 border border-[#b88a2f] bg-[#fff8df] p-5 font-mono text-xs leading-6 text-[#6d3f13] shadow-[4px_4px_0_0_rgba(184,138,47,0.16)]">
          {overview.unavailableReason}
        </section>
      ) : null}

      <section className="mt-6 grid gap-4 lg:grid-cols-[320px_1fr]">
        <WorkstationPanel className="overflow-hidden">
          <div className="border-b border-zinc-200 bg-[#f2f3ef] px-5 py-4">
            <h2 className="text-base font-semibold text-zinc-950">
              Series registry
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              {overview.source.toUpperCase()} registered series.
            </p>
          </div>
          <div className="divide-y divide-zinc-100">
            {overview.series.map((series) => {
              const isSelected = series.key === selectedSeries.key;
              const delta = getSeriesDelta(series);

              return (
                <button
                  key={series.key}
                  type="button"
                  onClick={() => setSelectedKey(series.key)}
                  className={`block w-full px-5 py-4 text-left hover:bg-[#fbfaf5] ${
                    isSelected ? "bg-[#eef2ea]" : "bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-zinc-950">
                        {series.label}
                      </div>
                      <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                        {series.seriesId} / {series.frequency}
                      </div>
                    </div>
                    <div
                      className={`shrink-0 font-mono text-xs font-semibold ${
                        delta !== null && delta < 0
                          ? "text-[#8a4b24]"
                          : "text-[#173b35]"
                      }`}
                    >
                      {formatSeriesDelta(series, delta)}
                    </div>
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <span className="text-sm text-zinc-600">
                      {formatDate(series.latestObservationDate)}
                    </span>
                    <span className="font-mono text-lg font-semibold text-zinc-950">
                      {formatSeriesValue(series, series.latestValue)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </WorkstationPanel>

        <div>
          <WorkstationPanel className="overflow-hidden">
            <div className="border-b border-zinc-200 bg-[#f2f3ef] px-5 py-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#6d5a2d]">
                    {selectedSeries.seriesId}
                  </div>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
                    {selectedSeries.label}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
                    {selectedSeries.description}
                  </p>
                </div>
                <div className="text-left md:text-right">
                  <div className="font-mono text-3xl font-semibold text-zinc-950">
                    {formatSeriesValue(displaySeries, displaySeries.latestValue)}
                  </div>
                  <div className="mt-1 font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">
                    {formatDate(displaySeries.latestObservationDate)}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-0 text-sm sm:grid-cols-4">
              <SummaryStat
                icon={<TrendingUp className="h-3.5 w-3.5" />}
                label="change"
                value={formatSeriesDelta(displaySeries, selectedDelta)}
              />
              <SummaryStat
                icon={<Activity className="h-3.5 w-3.5" />}
                label="frequency"
                value={selectedSeries.frequency}
              />
              <SummaryStat
                icon={<Database className="h-3.5 w-3.5" />}
                label="stored"
                value={`${displaySeries.observationCount} / ${selectedSeries.observationCount}`}
              />
              <SummaryStat
                icon={<RefreshCw className="h-3.5 w-3.5" />}
                label="fetched"
                value={formatTimestamp(selectedSeries.fetchedAt)}
              />
            </div>

            <div className="border-t border-zinc-200 px-5 py-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <div className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">
                    period
                  </div>
                  <div className="mt-1 font-mono text-sm font-medium text-zinc-950">
                    {periodLabel}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    ["all", "All"],
                    ["1y", "1Y"],
                    ["5y", "5Y"],
                    ["10y", "10Y"],
                    ["20y", "20Y"],
                    ["2000", "2000+"],
                    ["custom", "Custom"],
                  ].map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPeriodMode(mode as PeriodMode)}
                      className={`border px-3 py-2 font-mono text-xs font-semibold uppercase tracking-[0.12em] ${
                        periodMode === mode
                          ? "border-[#173b35] bg-[#173b35] text-[#f7f4ea]"
                          : "border-zinc-300 bg-white text-zinc-600 hover:border-zinc-950 hover:text-zinc-950"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {periodMode === "custom" ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">
                      start
                    </span>
                    <input
                      type="date"
                      min={selectedSeriesBounds.firstDate}
                      max={customEndDate || selectedSeriesBounds.latestDate}
                      value={customStartDate}
                      onChange={(event) => setCustomStartDate(event.target.value)}
                      className="mt-1 w-full border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-950 outline-none focus:border-[#173b35]"
                    />
                  </label>
                  <label className="block">
                    <span className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">
                      end
                    </span>
                    <input
                      type="date"
                      min={customStartDate || selectedSeriesBounds.firstDate}
                      max={selectedSeriesBounds.latestDate}
                      value={customEndDate}
                      onChange={(event) => setCustomEndDate(event.target.value)}
                      className="mt-1 w-full border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-950 outline-none focus:border-[#173b35]"
                    />
                  </label>
                </div>
              ) : null}
            </div>

            <div className="px-5 py-5">
              <SeriesSparkline series={displaySeries} periodMode={periodMode} />
            </div>
          </WorkstationPanel>

          <WorkstationPanel className="mt-6 overflow-x-auto">
            <div className="border-b border-zinc-200 px-5 py-4">
              <h2 className="text-base font-semibold text-zinc-950">
                Recent observations
              </h2>
            </div>
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="border-b border-zinc-200 bg-[#f2f3ef] font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">
                <tr>
                  <th className="py-2 pr-3 pl-5 font-medium">date</th>
                  <th className="py-2 pr-3 text-right font-medium">value</th>
                  <th className="py-2 pr-5 text-right font-medium">change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {tableRows.map((observation, index) => {
                  const nextObservation = tableRows[index + 1];
                  const delta =
                    observation.value !== null && nextObservation?.value !== undefined && nextObservation.value !== null
                      ? observation.value - nextObservation.value
                      : null;

                  return (
                    <tr key={observation.observationDate} className="hover:bg-[#fbfaf5]">
                      <td className="py-2 pr-3 pl-5 font-medium text-zinc-950">
                        {observation.observationDate}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono text-zinc-700">
                        {formatSeriesValue(displaySeries, observation.value)}
                      </td>
                      <td
                        className={`py-2 pr-5 text-right font-mono ${
                          delta !== null && delta < 0
                            ? "text-[#8a4b24]"
                            : "text-[#173b35]"
                        }`}
                      >
                        {formatSeriesDelta(displaySeries, delta)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </WorkstationPanel>
        </div>
      </section>
    </MacroOverviewShell>
  );
}

function MacroOverviewShell({ children }: { children: ReactNode }) {
  return (
    <WorkstationFrame
      title="macro data workstation"
      backHref="/dashboard"
      backLabel="Dashboard"
      maxWidthClassName="max-w-7xl"
    >
      {children}
    </WorkstationFrame>
  );
}
