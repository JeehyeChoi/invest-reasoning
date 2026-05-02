"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { TickerFactorMetricClusterOverview } from "@/shared/market/clusterOverview";
import { fetchMarketClusterOverview } from "@/features/market/services/fetchMarketClusterOverview";

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatNumber(value: number | null) {
  return value === null ? "-" : value.toFixed(2);
}

function formatFeatureValue(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}`;
}

function MarketWindowFrame({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden border border-zinc-950 bg-[#f6f7f4] shadow-[8px_8px_0_0_rgba(24,24,27,0.16)]">
      <div className="flex items-center justify-between border-b border-zinc-950 bg-[#173b35] px-3 py-2 text-[#f7f4ea]">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 border border-[#f7f4ea] bg-[#d8a541]" />
          <span className="font-mono text-xs font-semibold uppercase tracking-[0.22em]">
            {title}
          </span>
        </div>
        <div className="flex gap-1.5">
          <span className="h-3 w-3 border border-[#f7f4ea] bg-[#f7f4ea]/20" />
          <span className="h-3 w-3 border border-[#f7f4ea] bg-[#f7f4ea]/20" />
          <span className="h-3 w-3 border border-[#f7f4ea] bg-[#f7f4ea]/20" />
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}

function OverviewPanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`border border-zinc-300 bg-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9)] ${className}`}
    >
      {children}
    </section>
  );
}

export function MarketClusterOverview() {
  const [overview, setOverview] =
    useState<TickerFactorMetricClusterOverview | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    fetchMarketClusterOverview()
      .then((nextOverview) => {
        if (!isMounted) return;
        setOverview(nextOverview);
      })
      .catch((error) => {
        if (!isMounted) return;
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to fetch market cluster overview.",
        );
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (errorMessage) {
    return (
      <MarketClusterOverviewShell>
        <OverviewPanel className="p-6">
          <h1 className="text-lg font-semibold text-zinc-950">
            클러스터링 오버뷰를 불러오지 못했습니다
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            {errorMessage}
          </p>
        </OverviewPanel>
      </MarketClusterOverviewShell>
    );
  }

  if (!overview) {
    return (
      <MarketClusterOverviewShell>
        <OverviewPanel className="p-6">
          <h1 className="text-lg font-semibold text-zinc-950">
            클러스터링 오버뷰를 불러오는 중입니다
          </h1>
        </OverviewPanel>
      </MarketClusterOverviewShell>
    );
  }

  const tickersByCluster = new Map(
    overview.profiles.map((profile) => [
      profile.clusterId,
      overview.clusters
        .filter((cluster) => cluster.clusterId === profile.clusterId)
        .slice(0, 12),
    ]),
  );

  return (
    <MarketClusterOverviewShell>
          <section className="border-b border-zinc-300 pb-7">
          <div className="font-mono text-xs font-semibold uppercase tracking-[0.24em] text-[#6d5a2d]">
            Market Cluster Overview
          </div>
          <div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 md:text-4xl">
                회사 클러스터링 오버뷰
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
                저장된 factor-metric-signal vector 클러스터링 결과를 최신 run
                기준으로 보여줍니다.
              </p>
            </div>
            {overview.latestRun ? (
              <div className="grid min-w-full grid-cols-3 border border-zinc-950 bg-white text-right shadow-[4px_4px_0_0_rgba(24,24,27,0.12)] sm:min-w-[360px]">
                <div className="border-r border-zinc-200 px-3 py-3">
                  <div className="text-2xl font-semibold text-zinc-950">
                    {overview.latestRun.tickerCount}
                  </div>
                  <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                    tickers
                  </div>
                </div>
                <div className="border-r border-zinc-200 px-3 py-3">
                  <div className="text-2xl font-semibold text-zinc-950">
                    {overview.latestRun.featureCount}
                  </div>
                  <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                    features
                  </div>
                </div>
                <div className="px-3 py-3">
                  <div className="text-2xl font-semibold text-zinc-950">
                    {overview.latestRun.clusterCount}
                  </div>
                  <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                    clusters
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {overview.unavailableReason ? (
          <section className="mt-6 border border-[#b88a2f] bg-[#fff8df] p-5 font-mono text-xs leading-6 text-[#6d3f13] shadow-[4px_4px_0_0_rgba(184,138,47,0.16)]">
            {overview.unavailableReason}
          </section>
        ) : null}

        {!overview.latestRun ? (
          <OverviewPanel className="mt-6 p-6">
            <h2 className="text-lg font-semibold text-zinc-950">
              아직 저장된 클러스터링 결과가 없습니다
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              `factor_metric_clustering` job 또는 내부 clustering API를 실행하면
              이 페이지에 최신 run이 표시됩니다.
            </p>
          </OverviewPanel>
        ) : (
          <>
            <OverviewPanel className="mt-6 grid gap-0 text-sm md:grid-cols-2 xl:grid-cols-4">
              <div className="border-b border-zinc-200 p-4 md:border-r xl:border-b-0">
                <div className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">
                  scope
                </div>
                <div className="mt-1 font-medium text-zinc-950">
                  {overview.latestRun.factor}.{overview.latestRun.axis}
                </div>
              </div>
              <div className="border-b border-zinc-200 p-4 xl:border-r xl:border-b-0">
                <div className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">
                  comparison
                </div>
                <div className="mt-1 font-medium text-zinc-950">
                  {overview.latestRun.comparisonSetType}/
                  {overview.latestRun.comparisonSetKey}
                </div>
              </div>
              <div className="border-b border-zinc-200 p-4 md:border-r md:border-b-0">
                <div className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">
                  method
                </div>
                <div className="mt-1 font-medium text-zinc-950">
                  {overview.latestRun.normalizationMethod} +{" "}
                  {overview.latestRun.clusterMethod}
                </div>
              </div>
              <div className="p-4">
                <div className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">
                  computed
                </div>
                <div className="mt-1 font-medium text-zinc-950">
                  {overview.latestRun.computedAt}
                </div>
              </div>
            </OverviewPanel>

            <section className="mt-6 grid gap-4 lg:grid-cols-2">
              {overview.profiles.map((profile) => {
                const tickerRows = tickersByCluster.get(profile.clusterId) ?? [];

                return (
                  <article
                    key={profile.clusterId}
                    className="border border-zinc-300 bg-white shadow-[4px_4px_0_0_rgba(24,24,27,0.08)]"
                  >
                    <div className="flex items-start justify-between gap-4 border-b border-zinc-200 bg-[#f2f3ef] px-5 py-4">
                      <div>
                        <div className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#6d5a2d]">
                          Cluster {profile.clusterId}
                        </div>
                        <h2 className="mt-2 text-lg font-semibold text-zinc-950">
                          {profile.clusterLabel ?? `Cluster ${profile.clusterId}`}
                        </h2>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-semibold text-zinc-950">
                          {profile.clusterSize}
                        </div>
                        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                          companies
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-0 border-b border-zinc-100 text-sm sm:grid-cols-3">
                      <div>
                        <div className="border-b border-zinc-100 px-5 py-3 sm:border-r sm:border-b-0">
                          <div className="text-xs text-zinc-500">coverage</div>
                          <div className="font-medium text-zinc-950">
                          {formatPercent(profile.averageCoverageRatio)}
                          </div>
                        </div>
                      </div>
                      <div>
                        <div className="border-b border-zinc-100 px-5 py-3 sm:border-r sm:border-b-0">
                          <div className="text-xs text-zinc-500">distance</div>
                          <div className="font-medium text-zinc-950">
                          {formatNumber(profile.averageDistanceToCentroid)}
                          </div>
                        </div>
                      </div>
                      <div className="px-5 py-3">
                        <div className="text-xs text-zinc-500">features</div>
                        <div className="font-medium text-zinc-950">
                          {profile.featureCount}
                        </div>
                      </div>
                    </div>

                    <div className="px-5 py-4">
                      <h3 className="text-sm font-semibold text-zinc-950">
                        Distinguishing features
                      </h3>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {profile.distinguishingFeatures.slice(0, 6).map((feature) => (
                          <span
                            key={feature.featureKey}
                            className="border border-zinc-300 bg-[#f7f7f2] px-2.5 py-1 font-mono text-xs text-zinc-700"
                          >
                            {feature.metricKey}.{feature.signalKey}{" "}
                            <span className="font-semibold text-[#173b35]">
                              {formatFeatureValue(feature.value)}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="overflow-x-auto border-t border-zinc-200">
                      <table className="w-full min-w-[520px] text-left text-sm">
                        <thead className="border-b border-zinc-200 bg-[#f2f3ef] font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">
                          <tr>
                            <th className="py-2 pr-3 pl-5 font-medium">ticker</th>
                            <th className="py-2 pr-3 font-medium">company</th>
                            <th className="py-2 pr-3 font-medium">sector</th>
                            <th className="py-2 pr-5 text-right font-medium">
                              distance
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {tickerRows.map((ticker) => (
                            <tr key={ticker.ticker} className="hover:bg-[#fbfaf5]">
                              <td className="py-2 pr-3 pl-5 font-semibold text-zinc-950">
                                <Link
                                  href={`/tickers/${ticker.ticker}`}
                                  className="underline decoration-[#b88a2f] underline-offset-4 hover:text-[#173b35]"
                                >
                                  {ticker.ticker}
                                </Link>
                              </td>
                              <td className="py-2 pr-3 text-zinc-700">
                                {ticker.companyName ?? "-"}
                              </td>
                              <td className="py-2 pr-3 text-zinc-600">
                                {ticker.sector ?? "-"}
                              </td>
                              <td className="py-2 pr-5 text-right font-mono text-zinc-700">
                                {formatNumber(ticker.distanceToCentroid)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </article>
                );
              })}
            </section>
          </>
        )}
    </MarketClusterOverviewShell>
  );
}

function MarketClusterOverviewShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#d8ddd2] px-3 py-4 text-zinc-950 md:px-5 md:py-6">
      <MarketWindowFrame title="market signal workstation">
        <div className="border-b border-zinc-950 bg-[#eceee8] px-4 py-2 md:px-6">
          <Link
            href="/dashboard"
            className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-[#173b35] underline decoration-[#b88a2f] underline-offset-4 hover:text-zinc-950"
          >
            Dashboard
          </Link>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
          {children}
        </div>
      </MarketWindowFrame>
    </main>
  );
}
