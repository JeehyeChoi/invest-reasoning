// features/filings/components/RecentFilingsPanel.tsx

"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchRecentFilings } from "@/features/filings/services/fetchRecentFilings";
import type { RecentFilingItem } from "@/features/filings/schemas/recentFilings";
import { DEFAULT_FILINGS_LOOKBACK_DAYS } from "@/shared/constants/filings";
import { FILING_FORM_LABELS, FILING_ITEM_LABELS, FILING_EXHIBIT_LABELS } from "@/shared/constants/filings";
import type { FilingItemEntry, FilingExhibitEntry } from "../schemas/recentFilings";

type RecentFilingsPanelProps = {
  tickers: string[];
  days?: number;
};

export function RecentFilingsPanel({
  tickers,
  days = DEFAULT_FILINGS_LOOKBACK_DAYS,
}: RecentFilingsPanelProps) {
  const [items, setItems] = useState<RecentFilingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedTickers = useMemo(() => {
    return Array.from(
      new Set(tickers.map((ticker) => ticker.trim().toUpperCase()).filter(Boolean))
    );
  }, [tickers]);

  const tickersKey = normalizedTickers.join(",");

  useEffect(() => {
    if (normalizedTickers.length === 0) {
      setItems([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);

      try {
        const result = await fetchRecentFilings({
          tickers: normalizedTickers,
          days,
        });

        if (!cancelled) {
          setItems(result.items ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          setError("Failed to load recent filings.");
          setItems([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [tickersKey, days, normalizedTickers]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3">
        <h2 className="text-base font-semibold text-slate-900">
          Recent Filings
        </h2>
        <p className="text-sm text-slate-500">
          Watchlist only · Last {days} days
        </p>
      </div>

      {loading && (
        <div className="text-sm text-slate-600">
          Loading recent watchlist filings...
        </div>
      )}

      {!loading && error && (
        <div className="text-sm text-red-600">{error}</div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="text-sm text-slate-500">
          No recent SEC filings found for the selected tickers.
        </div>
      )}

			{!loading && !error && items.length > 0 && (
				<div className="space-y-3">
					{items.map((item) => {
						const filingItems = item.filingItems ?? [];
						const exhibits = item.exhibits ?? [];

						return (
							<div
								key={`${item.ticker}-${item.accessionNumber}`}
								className="rounded-lg border border-slate-200 p-3"
							>
								<div className="flex items-center justify-between gap-3">
									<div>
										<div className="font-medium text-slate-900">
											{item.ticker}
											{item.companyName ? ` · ${item.companyName}` : ""}
										</div>
										<div className="text-sm font-medium text-slate-900">
  										{item.form}: {FILING_FORM_LABELS[item.form]} · {item.filingDate}
										</div>
									</div>

									{item.secUrl ? (
										<a
											href={item.secUrl}
											target="_blank"
											rel="noreferrer"
											className="text-sm font-medium text-slate-700 underline"
										>
											Open
										</a>
									) : null}
								</div>

								{filingItems.length > 0 && (
									<div className="mt-2">
										<div className="text-xs font-medium text-slate-700">Items</div>
										<div className="mt-1 space-y-2">
											{filingItems.map((fi) => {
												const dividend =
													fi.signal?.type === "dividend" &&
													fi.signal.data &&
													typeof fi.signal.data === "object"
														? (fi.signal.data as {
																previousPerShare?: number | null;
																currentPerShare?: number | null;
																annualizedPerShare?: number | null;
																recordDate?: string | null;
																paymentDate?: string | null;
															})
														: null;

												return (
													<div
														key={`${item.accessionNumber}-item-${fi.itemCode}`}
														className="rounded bg-slate-50 px-2 py-2 text-xs text-slate-700"
													>
														<div className="font-medium">
															{fi.itemCode}
															{FILING_ITEM_LABELS[fi.itemCode]
																? ` · ${FILING_ITEM_LABELS[fi.itemCode]}`
																: fi.itemTitle
																? ` · ${fi.itemTitle}`
																: ""}
														</div>

														{dividend && (
															<div className="mt-1 text-slate-600">
																Dividend
																{typeof dividend.previousPerShare === "number" &&
																typeof dividend.currentPerShare === "number"
																	? ` · $${dividend.previousPerShare.toFixed(2)} → $${dividend.currentPerShare.toFixed(2)}`
																	: ""}
																{typeof dividend.annualizedPerShare === "number"
																	? ` · Annualized $${dividend.annualizedPerShare.toFixed(2)}`
																	: ""}
																{dividend.recordDate ? ` · Record ${dividend.recordDate}` : ""}
																{dividend.paymentDate ? ` · Pay ${dividend.paymentDate}` : ""}
															</div>
														)}
													</div>
												);
											})}
										</div>
									</div>
								)}

								{exhibits.length > 0 && (
									<div className="mt-2">
										<div className="text-xs font-medium text-slate-700">Exhibits</div>
										<div className="mt-1 space-y-1">
											{exhibits.map((ex) => (
												<div
													key={`${item.accessionNumber}-exhibit-${ex.exhibitNo}`}
													className="text-xs text-slate-600"
												>
													{ex.exhibitNo}
													{FILING_EXHIBIT_LABELS[ex.exhibitNo]
														? ` · ${FILING_EXHIBIT_LABELS[ex.exhibitNo]}`
														: ex.description
														? ` · ${ex.description}`
														: ""}
												</div>
											))}
										</div>
									</div>
								)}
							</div>
						);
					})}
				</div>
			)}
    </section>
  );
}
