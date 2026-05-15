"use client";

import { useEffect, useMemo, useState } from "react";

import type {
  TickerImpliedFinancialExpectation,
  TickerImpliedFinancialExpectationsResponse,
} from "@/shared/expectations/tickerImpliedFinancialExpectations";
import {
  Panel,
  Td,
  Th,
} from "@/features/tickers/components/TickerDetailPrimitives";
import { fetchTickerImpliedFinancialExpectations } from "@/features/expectations/services/fetchTickerImpliedFinancialExpectations";

type Props = {
  ticker: string;
};

export function TickerImpliedFinancialExpectationsPanel({ ticker }: Props) {
  const [data, setData] =
    useState<TickerImpliedFinancialExpectationsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        setIsLoading(true);
        setError(null);

        const result = await fetchTickerImpliedFinancialExpectations(ticker);

        if (!isMounted) return;
        setData(result);
      } catch (err) {
        if (!isMounted) return;
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load implied expectations",
        );
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

  const rows = useMemo(() => data?.expectations ?? [], [data]);

  if (isLoading) {
    return (
      <Panel title="Implied Financial Expectations">
        <p className="font-mono text-sm">Loading expectation scenarios...</p>
      </Panel>
    );
  }

  if (error) {
    return (
      <Panel title="Implied Financial Expectations">
        <p className="font-bold">Load Error</p>
        <p className="mt-2 font-mono text-sm">{error}</p>
      </Panel>
    );
  }

  if (rows.length === 0) {
    return (
      <Panel title="Implied Financial Expectations">
        <p className="font-mono text-sm">
          No implied expectation rows have been built for {ticker.toUpperCase()}.
        </p>
      </Panel>
    );
  }

  return (
    <Panel title="Implied Financial Expectations">
      <div className="grid gap-3">
        <div className="grid gap-2 text-sm md:grid-cols-4">
          <MetricBox
            label="As Of"
            value={data?.asOfDate ?? rows[0]?.asOfDate ?? "N/A"}
          />
          <MetricBox
            label="Revenue TTM"
            value={formatCurrency(rows[0]?.currentRevenueTtm)}
          />
          <MetricBox
            label="EV / Sales"
            value={formatMultiple(rows[0]?.currentEvSalesMultiple)}
          />
          <MetricBox
            label="P / E"
            value={formatMultiple(rows[0]?.currentPeMultiple)}
          />
        </div>

        <div className="overflow-x-auto border border-black bg-white">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-[#c0c0c0]">
              <tr>
                <Th>Scenario</Th>
                <Th>Discount</Th>
                <Th>Terminal EV/S</Th>
                <Th>Implied Revenue</Th>
                <Th>Revenue CAGR</Th>
                <Th>Terminal P/E</Th>
                <Th>Implied Net Income</Th>
                <Th>EPS CAGR</Th>
                <Th>Burden</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <ExpectationRow key={row.assumptionSetKey} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Panel>
  );
}

function ExpectationRow({
  row,
}: {
  row: TickerImpliedFinancialExpectation;
}) {
  return (
    <tr>
      <Td>
        <span className="font-bold">{formatScenario(row.assumptionSetKey)}</span>
        <span className="block font-mono text-xs">{row.horizonYears}Y</span>
      </Td>
      <Td>{formatPercent(row.discountRate)}</Td>
      <Td>{formatMultiple(row.terminalEvSalesMultiple)}</Td>
      <Td>{formatCurrency(row.impliedRevenueTerminal)}</Td>
      <Td>{formatPercent(row.impliedRevenueCagr)}</Td>
      <Td>{formatMultiple(row.terminalPeMultiple)}</Td>
      <Td>{formatCurrency(row.impliedNetIncomeTerminal)}</Td>
      <Td>{formatPercent(row.impliedEpsCagr)}</Td>
      <Td>{formatScore(row.expectationBurdenScore)}</Td>
    </tr>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-black bg-[#f5f5f5] p-2">
      <div className="font-mono text-xs uppercase">{label}</div>
      <div className="mt-1 font-bold">{value}</div>
    </div>
  );
}

function formatScenario(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "N/A";
  }

  const abs = Math.abs(value);
  const suffixes = [
    { threshold: 1_000_000_000_000, suffix: "T" },
    { threshold: 1_000_000_000, suffix: "B" },
    { threshold: 1_000_000, suffix: "M" },
  ];
  const suffix = suffixes.find((entry) => abs >= entry.threshold);

  if (!suffix) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  }

  return `$${(value / suffix.threshold).toFixed(1)}${suffix.suffix}`;
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "N/A";
  }

  return `${(value * 100).toFixed(1)}%`;
}

function formatMultiple(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "N/A";
  }

  return `${value.toFixed(1)}x`;
}

function formatScore(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "N/A";
  }

  return `${Math.round(value * 100)}/100`;
}
