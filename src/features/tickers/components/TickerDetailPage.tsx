"use client";

import { useEffect, useMemo, useState } from "react";

import type { TickerOverview } from "@/backend/schemas/tickers/tickerOverview";
import {
  StatusRow,
  WindowFrame,
  Panel,
} from "@/features/tickers/components/TickerDetailPrimitives";
import { TickerHeaderPanel } from "@/features/tickers/components/TickerHeaderPanel";
import { TickerHeadlineMetricPanel } from "@/features/tickers/components/TickerHeadlineMetricPanel";
import { TickerHeadlineChartPanel } from "@/features/tickers/components/TickerHeadlineChartPanel";
import { TickerMetricBreakdownPanel } from "@/features/tickers/components/TickerMetricBreakdownPanel";
import { TickerAllFactorMetricsPanel } from "@/features/tickers/components/TickerAllFactorMetricsPanel";
import { fetchTickerOverview } from "@/features/tickers/services/fetchTickerOverview";
import { pickHeadlineMetric } from "@/features/tickers/utils/pickHeadlineMetric";

type Props = {
  ticker: string;
};

export function TickerDetailPage({ ticker }: Props) {
  const [data, setData] = useState<TickerOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const headlineMetric = pickHeadlineMetric(data.factorMetrics);

  return (
    <main className="min-h-screen bg-[#008080] p-4 text-black">
      <WindowFrame title={`${data.ticker} — Overview`}>
        <div className="grid gap-4">
          <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <TickerHeaderPanel ticker={data.ticker} company={data.company} />
            <TickerHeadlineMetricPanel metric={headlineMetric} />
          </section>

          <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
						<TickerHeadlineChartPanel ticker={data.ticker} metric={headlineMetric} />
            <TickerMetricBreakdownPanel metric={headlineMetric} />
          </section>

          <section>
            <TickerAllFactorMetricsPanel factorMetrics={data.factorMetrics} />
          </section>

          <div className="border border-black bg-[#c0c0c0] px-2 py-1 text-xs">
            <span className="font-mono">
              STATUS: READY | TICKER={data.ticker} | METRICS={data.factorMetrics.length}
            </span>
          </div>
        </div>
      </WindowFrame>
    </main>
  );
}
