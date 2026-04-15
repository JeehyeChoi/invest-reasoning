"use client";

import { useEffect, useState } from "react";
import {
  fetchMarketStatus,
  type MarketStatusResponse,
} from "@/features/market/services/fetchMarketStatus";

export function MarketStatus() {
  const [data, setData] = useState<MarketStatusResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const result = await fetchMarketStatus();
        if (!cancelled) setData(result);
      } catch (err) {
        console.error(err);
        if (!cancelled) setError("Failed to load market status");
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="rounded border bg-red-50 p-3 text-sm text-red-600">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded border bg-gray-50 p-3 text-sm text-gray-500">
        Loading market status...
      </div>
    );
  }

  return (
    <div className="rounded border bg-white p-3">
      <div className="text-sm font-medium text-slate-900">{data.label}</div>
      {data.nowNy && (
        <div className="mt-1 text-xs text-slate-500">{data.nowNy}</div>
      )}
    </div>
  );
}
