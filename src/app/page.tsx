"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Pencil, Trash2, RotateCcw } from "lucide-react"

import { formatNumber, formatPercent } from "@/shared/utils/format"
import { PortfolioItemInput } from "@/shared/types/portfolio"
import type { LlmProvider, AnalysisStrategy } from "@/shared/types/analysis"
import type { PriceMap } from "@/shared/types/portfolio"
import type { PortfolioAnalysisWorkflowInput } from "@/shared/types/workflow"

import PortfolioInput from "@/features/portfolio/components/PortfolioInput"
import { calculatePortfolio } from "@/features/portfolio/utils/calculatePortfolio"
import { loadPortfolioState, savePortfolioState } from "@/features/portfolio/utils/storage"

import { AnalysisResult } from "@/features/analysis/components/AnalysisResult"
import { AnalysisLoading } from "@/features/analysis/components/AnalysisLoading"
import { loadPortfolioPrices } from "@/features/portfolio/services/loadPortfolioPrices"
import { RecentFilingsPanel } from "@/features/filings/components/RecentFilingsPanel"
import { MarketStatus } from "@/features/market/components/MarketStatus"

const CASH_TICKER = "__CASH__"
const BUY_ONLY_TOLERANCE = 0.5

type CalculatedPortfolioRow = ReturnType<typeof calculatePortfolio>[number]

type PortfolioTableRow = CalculatedPortfolioRow & {
  weightGap?: number
  buyOnlyAmount?: number
  buyOnlyShares?: number
}

function getItemCurrentValue(item: CalculatedPortfolioRow) {
  if (item.ticker === CASH_TICKER) {
    return item.totalCost ?? 0
  }

  return item.currentValue ?? 0
}

export default function HomePage() {
  const [items, setItems] = useState<PortfolioItemInput[]>([
    {
      ticker: CASH_TICKER,
      totalCost: 0,
    },
  ])

  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [pendingDeletes, setPendingDeletes] = useState<
    Record<number, { expiresAt: number }>
  >({})
  const [remainingSecondsMap, setRemainingSecondsMap] = useState<
    Record<number, number>
  >({})
  const [priceMap, setPriceMap] = useState<PriceMap>({})
  const [priceUpdatedAt, setPriceUpdatedAt] = useState<number | null>(null)
  const [priceError, setPriceError] = useState<string>("")
	const [priceWarning, setPriceWarning] = useState("")
	const [priceLoading, setPriceLoading] = useState(false)
	const [priceLoadingMessage, setPriceLoadingMessage] = useState("")
	const [priceCountdown, setPriceCountdown] = useState<number | null>(null)

  const [provider, setProvider] = useState<LlmProvider>("claude")
  const [strategy, setStrategy] = useState<AnalysisStrategy>("papic")
  const [analysisResult, setAnalysisResult] = useState<string>("")
  const [loading, setLoading] = useState(false)

  const hasShownCashTargetWeightAlert = useRef(false)

  useEffect(() => {
    const saved = loadPortfolioState()
    if (!saved) return

    setItems(saved.items)
    setProvider(saved.provider)
    setStrategy(saved.strategy)
    setPriceMap(saved.priceMap)
    setPriceUpdatedAt(saved.priceUpdatedAt)
  }, [])

  useEffect(() => {
    savePortfolioState({
      items,
      provider,
      strategy,
      priceMap,
      priceUpdatedAt,
    })
  }, [items, provider, strategy, priceMap, priceUpdatedAt])

  useEffect(() => {
    if (Object.keys(pendingDeletes).length === 0) {
      return
    }

    const intervalId = setInterval(() => {
      const now = Date.now()

      setRemainingSecondsMap((prev) => {
        const next: Record<number, number> = {}

        for (const [key, value] of Object.entries(pendingDeletes)) {
          const index = Number(key)
          const seconds = Math.max(0, Math.ceil((value.expiresAt - now) / 1000))
          next[index] = seconds
        }

        const prevKeys = Object.keys(prev)
        const nextKeys = Object.keys(next)

        const isSame =
          prevKeys.length === nextKeys.length &&
          prevKeys.every((key) => prev[Number(key)] === next[Number(key)])

        return isSame ? prev : next
      })

      const expiredIndexes = Object.entries(pendingDeletes)
        .filter(([, value]) => value.expiresAt <= now)
        .map(([key]) => Number(key))

      if (expiredIndexes.length > 0) {
        setItems((prev) => prev.filter((_, index) => !expiredIndexes.includes(index)))

        setPendingDeletes((prev) => {
          const next = { ...prev }
          expiredIndexes.forEach((index) => {
            delete next[index]
          })
          return next
        })

        setRemainingSecondsMap((prev) => {
          const next = { ...prev }
          expiredIndexes.forEach((index) => {
            delete next[index]
          })
          return next
        })

        if (editingIndex !== null && expiredIndexes.includes(editingIndex)) {
          setEditingIndex(null)
        }
      }
    }, 250)

    return () => clearInterval(intervalId)
  }, [pendingDeletes, editingIndex])

	useEffect(() => {
		if (priceCountdown === null || priceCountdown <= 0) {
			return;
		}

		const timeoutId = window.setTimeout(() => {
			setPriceCountdown((prev) => {
				if (prev === null || prev <= 1) {
					return null;
				}
				return prev - 1;
			});
		}, 1000);

		return () => window.clearTimeout(timeoutId);
	}, [priceCountdown]);

	useEffect(() => {
		const tickers = items
			.map((item) => item.ticker)
			.filter((ticker): ticker is string => !!ticker && ticker !== CASH_TICKER)

		if (tickers.length === 0) {
			setPriceMap({})
			setPriceUpdatedAt(null)
			setPriceError("")
			setPriceLoading(false)
			setPriceLoadingMessage("")
			return
		}

		const loadPrices = async () => {
			setPriceLoading(true)
			setPriceError("")
			setPriceWarning("")

			try {
				const { prices, failedTickers, warnings, error } = await loadPortfolioPrices({
					tickers,
					onProgress: (progress) => {
						setPriceLoadingMessage(progress.message)
					},
					onBatchComplete: (partialPrices) => {
						setPriceMap((prev) => ({
							...prev,
							...partialPrices,
						}))
					},
					onWarning: (warning) => {
						setPriceWarning((prev) => (prev ? `${prev}\n${warning}` : warning))
					},
					onError: (message) => {
						setPriceError(message)
					},
				})

				setPriceMap((prev) => ({
					...prev,
					...prices,
				}))

				if (error) {
					setPriceError(error)
					setPriceWarning("")
				} else {
					setPriceError("")

					if (warnings?.length > 0) {
						setPriceWarning(warnings.join("\n"))
					} else if (failedTickers.length > 0) {
						setPriceWarning(`Failed tickers: ${failedTickers.join(", ")}`)
					} else {
						setPriceWarning("")
					}
				}

				setPriceUpdatedAt(Date.now())
			} catch (error) {
				console.error(error)
				setPriceError("Failed to update prices.")
				setPriceWarning("")
			} finally {
				setPriceLoading(false)
				setPriceLoadingMessage("")
			}
		}

		void loadPrices()
	}, [items])

  const getNextTotalTargetWeight = (
    nextItem: PortfolioItemInput,
    editingIndexToExclude?: number | null,
  ) => {
    const otherWeightSum = items
      .filter((_, index) =>
        editingIndexToExclude !== undefined && editingIndexToExclude !== null
          ? index !== editingIndexToExclude
          : true,
      )
      .reduce((sum, portfolioItem) => sum + (portfolioItem.targetWeight ?? 0), 0)

    return otherWeightSum + (nextItem.targetWeight ?? 0)
  }

  const handleAdd = (item: PortfolioItemInput) => {
    const normalizedTicker = item.ticker.trim().toUpperCase()

    const alreadyExists = items.some(
      (existingItem) => existingItem.ticker === normalizedTicker,
    )

    if (alreadyExists) {
      alert("This ticker is already in the portfolio.")
      return
    }

    const normalizedItem: PortfolioItemInput = {
      ...item,
      ticker: normalizedTicker,
    }

    const nextTotalWeight = getNextTotalTargetWeight(normalizedItem)

    if (nextTotalWeight > 100) {
      alert(
        `Total target weight cannot exceed 100%. Current total would be ${nextTotalWeight.toFixed(2)}%.`,
      )
      return
    }

    setItems((prev) => [...prev, normalizedItem])
  }

  const handleDelete = (indexToDelete: number) => {
    setPendingDeletes((prev) => ({
      ...prev,
      [indexToDelete]: {
        expiresAt: Date.now() + 3000,
      },
    }))
  }

  const handleUndoDelete = (indexToUndo: number) => {
    setPendingDeletes((prev) => {
      const next = { ...prev }
      delete next[indexToUndo]
      return next
    })
    setRemainingSecondsMap((prev) => {
      const next = { ...prev }
      delete next[indexToUndo]
      return next
    })
  }

  const handleEdit = (indexToEdit: number) => {
    setEditingIndex(indexToEdit)
  }

  const handleSave = (updatedItem: PortfolioItemInput) => {
    if (editingIndex === null) return

    const normalizedItem: PortfolioItemInput = {
      ...updatedItem,
      ticker: updatedItem.ticker.trim().toUpperCase(),
    }

    const nextTotalWeight = getNextTotalTargetWeight(normalizedItem, editingIndex)

    if (nextTotalWeight > 100) {
      alert(
        `Total target weight cannot exceed 100%. Current total would be ${nextTotalWeight.toFixed(2)}%.`,
      )
      setEditingIndex(null)
      return
    }

    setItems((prev) =>
      prev.map((item, index) => (index === editingIndex ? normalizedItem : item)),
    )

    setEditingIndex(null)
  }

  const handleCancel = () => {
    setEditingIndex(null)
  }

  const editingItem = editingIndex !== null ? items[editingIndex] : null

  const calculatedItems = calculatePortfolio(items, priceMap)

  const tableItems = useMemo<PortfolioTableRow[]>(() => {
    const cashItem = calculatedItems.find((item) => item.ticker === CASH_TICKER)
    const cashCurrentValue = cashItem ? getItemCurrentValue(cashItem) : 0
    const cashTargetWeight = cashItem?.targetWeight

    const hasCashTargetWeight = cashTargetWeight !== undefined && cashTargetWeight !== null

		const totalPortfolioValue = calculatedItems.reduce(
			(sum, item) => sum + getItemCurrentValue(item),
			0,
		)

		const investableCash = hasCashTargetWeight
			? Math.max(cashCurrentValue - (cashTargetWeight / 100) * totalPortfolioValue, 0)
			: 0

    const nonCashRows = calculatedItems.filter((item) => item.ticker !== CASH_TICKER)

    const deficitRows = nonCashRows.map((item) => {
      const currentValue = getItemCurrentValue(item)
      const targetWeight = item.targetWeight ?? 0
      const currentWeight = item.currentWeight ?? 0
			const targetValue = (targetWeight / 100) * totalPortfolioValue
      const deficitValue = Math.max(targetValue - currentValue, 0)

      return {
        ...item,
        weightGap: currentWeight - targetWeight,
        deficitValue,
      }
    })

    const totalDeficitValue = deficitRows.reduce(
      (sum, item) => sum + item.deficitValue,
      0,
    )

    const suggestedRows: PortfolioTableRow[] = deficitRows.map((item) => {
      const buyOnlyAmount =
        totalDeficitValue > 0 && investableCash > 0
          ? (item.deficitValue / totalDeficitValue) * investableCash
          : 0

      const buyOnlyShares =
        buyOnlyAmount > 0 && item.currentPrice && item.currentPrice > 0
          ? buyOnlyAmount / item.currentPrice
          : undefined

      return {
        ...item,
        buyOnlyAmount,
        buyOnlyShares,
      }
    })

    const cashRow: PortfolioTableRow | undefined = cashItem
      ? {
          ...cashItem,
          currentValue: cashCurrentValue,
          weightGap:
            (cashItem.currentWeight ?? 0) - (cashItem.targetWeight ?? 0),
          buyOnlyAmount: investableCash > 0 ? -investableCash : 0,
        }
      : undefined

    return cashRow ? [cashRow, ...suggestedRows] : suggestedRows
  }, [calculatedItems])

	const watchlistTickers = useMemo(() => {
		return Array.from(
			new Set(
				items
					.map((item) => item.ticker?.trim().toUpperCase())
					.filter((ticker): ticker is string => !!ticker && ticker !== CASH_TICKER)
			)
		);
	}, [items]);

  useEffect(() => {
    const cashItem = calculatedItems.find((item) => item.ticker === CASH_TICKER)

    const missingCashTargetWeight =
      !!cashItem && (cashItem.totalCost ?? 0) > 0 && cashItem.targetWeight === undefined

    if (missingCashTargetWeight && !hasShownCashTargetWeightAlert.current) {
      hasShownCashTargetWeightAlert.current = true
      alert(
        "Cash target weight is required to calculate Buy Only suggestions. Please edit the Cash row and enter a target weight.",
      )
      return
    }

    if (!missingCashTargetWeight) {
      hasShownCashTargetWeightAlert.current = false
    }
  }, [calculatedItems])

  const handleAnalyze = async () => {
    try {
      setLoading(true)

      const payload: PortfolioAnalysisWorkflowInput = {
        provider,
        strategy,
        calculatedPortfolio: calculatedItems,
      }

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || "Failed to analyze")
        return
      }

      setAnalysisResult(data.result)
    } catch (err) {
      console.error(err)
      alert("Error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Geo Portfolio</h1>
        <p className="text-sm text-gray-600">
          Portfolio input and allocation dashboard
        </p>
      </div>

      <PortfolioInput
        onAdd={handleAdd}
        onSave={handleSave}
        onCancel={handleCancel}
        editingItem={editingItem}
        isEditing={editingIndex !== null}
      />

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Current Inputs</h2>

          <button
            type="button"
            onClick={handleAnalyze}
            disabled={loading}
            className={`rounded p-2 px-4 text-white ${
              loading ? "cursor-not-allowed bg-gray-400" : "bg-purple-600"
            }`}
          >
            {loading ? "Analyzing..." : "Analyze Portfolio"}
          </button>
        </div>

				<div className="mt-2 text-sm text-gray-500">
					{priceUpdatedAt
						? `Prices updated: ${new Date(priceUpdatedAt).toLocaleString("en-US")}`
						: "Prices not loaded yet."}
				</div>

				{priceLoadingMessage && (
					<div className="mt-1 text-sm text-slate-600">
						{priceCountdown !== null
							? `Loading prices... Next batch in ${priceCountdown}s...`
							: priceLoadingMessage}
					</div>
				)}

				{priceError && (
					<div className="mt-1 text-sm text-red-600 whitespace-pre-line">
						{priceError}
					</div>
				)}

				{priceWarning && (
					<div className="mt-1 text-sm text-amber-600 whitespace-pre-line">
						{priceWarning}
					</div>
				)}

        <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          Buy Only suggestions use excess cash above the cash target weight. Cash target weight is required for this view.
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-gray-500">No portfolio items yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border border-gray-300 text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border p-2 text-left">Ticker</th>
                  <th className="border p-2 text-left">Shares</th>
                  <th className="border p-2 text-left">Avg. Buy Price</th>
                  <th className="border p-2 text-left">Total Cost</th>
                  <th className="border p-2 text-left">Current Price</th>
                  <th className="border p-2 text-left">Current Value</th>
                  <th className="border p-2 text-left">Current Weight</th>
                  <th className="border p-2 text-left">Target Weight</th>
                  <th className="border p-2 text-left">Buy Only</th>
                  <th className="border p-2 text-left">Actions</th>
                </tr>
              </thead>

              <tbody>
                {tableItems.map((item, index) => {
                  const isCash = item.ticker === CASH_TICKER
                  const weightGap = item.weightGap ?? 0
                  const gapLabel =
                    weightGap > 0
                      ? ` (+${formatPercent(weightGap)})`
                      : weightGap < 0
                        ? ` (${formatPercent(weightGap)})`
                        : ""

                  return (
                    <tr key={`${item.ticker}-${index}`} className="hover:bg-gray-50">
                      <td className="border p-2 font-medium">{isCash ? "Cash" : item.ticker}</td>

                      <td className="border p-2">{isCash ? "N/A" : item.shares ?? "-"}</td>

                      <td className="border p-2">
                        {isCash ? "N/A" : formatNumber(item.averageBuyPrice)}
                      </td>

                      <td className="border p-2">{formatNumber(item.totalCost)}</td>

											<td className="border p-2">
												{isCash
													? "N/A"
													: item.currentPrice != null
														? formatNumber(item.currentPrice)
														: priceLoading
															? "Processing..."
															: "-"}
											</td>

                      <td className="border p-2">{formatNumber(getItemCurrentValue(item))}</td>

                      <td className="border p-2">
                        {formatPercent(item.currentWeight)}
                        {gapLabel && (
                          <span
                            className={`ml-1 text-xs ${
                              weightGap > 0 ? "text-amber-700" : "text-blue-700"
                            }`}
                          >
                            {gapLabel}
                          </span>
                        )}
                      </td>

                      <td className="border p-2">{formatPercent(item.targetWeight)}</td>

											<td className="border p-2">
												{isCash ? (
													item.buyOnlyAmount && item.buyOnlyAmount < 0 ? (
														<span className="text-amber-700">
															Reserve {formatNumber(Math.abs(item.buyOnlyAmount))}
														</span>
													) : (
														"-"
													)
												) : Math.abs(weightGap) <= BUY_ONLY_TOLERANCE ? (
													<span className="text-emerald-700">On target</span>
												) : item.buyOnlyAmount && item.buyOnlyAmount > 0 ? (
													<div className="space-y-1">
														<div className="text-blue-700">
															Buy {formatNumber(item.buyOnlyAmount)}
														</div>
														{item.buyOnlyShares !== undefined && (
															<div className="text-xs text-gray-500">
																≈ {formatNumber(item.buyOnlyShares)} shares
															</div>
														)}
													</div>
												) : weightGap > 0 ? (
													<span className="text-amber-700">Overweight</span>
												) : (
													<span className="text-blue-700">Rebalancing needed</span>
												)}
											</td>

                      <td className="border p-2">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(index)}
                            className="rounded p-1 hover:bg-gray-200"
                            title="Edit"
                            disabled={!!pendingDeletes[index]}
                          >
                            <Pencil size={16} />
                          </button>

                          {pendingDeletes[index] ? (
                            <button
                              onClick={() => handleUndoDelete(index)}
                              className="flex items-center gap-1 rounded px-2 py-1 text-amber-700 hover:bg-amber-100"
                              title="Undo delete"
                            >
                              <RotateCcw size={16} />
                              <span className="text-xs">{remainingSecondsMap[index] ?? 0}s</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleDelete(index)}
                              className="rounded p-1 text-red-600 hover:bg-red-100"
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

				<MarketStatus />

				<div className="mt-6">
					<RecentFilingsPanel tickers={watchlistTickers} />
				</div>

        <div className="flex min-h-[120px] items-center justify-center rounded border bg-gray-50 p-4">
          {loading ? (
            <AnalysisLoading />
          ) : analysisResult ? (
            <AnalysisResult result={analysisResult} />
          ) : (
            <span className="text-gray-400">Click "Analyze" to get recommendation</span>
          )}
        </div>
      </section>


    </main>
  )
}
