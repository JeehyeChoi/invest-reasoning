"use client"

import { useEffect, useState } from "react"
import PortfolioInput from "@/features/portfolio/components/PortfolioInput"
import { PortfolioItemInput, PortfolioItemComputed } from "@/shared/types/portfolio"
import { completePortfolioItem } from "@/features/portfolio/utils/completePortfolioItem"
import { calculatePortfolio } from "@/features/portfolio/utils/calculatePortfolio"
import { formatNumber, formatPercent } from "@/shared/utils/format"
import { Pencil, Trash2, RotateCcw } from "lucide-react"
import { fetchPrices } from "@/backend/clients/prices"
import type { LlmProvider, AnalysisStrategy } from "@/shared/types/analysis"

export default function HomePage() {
	const [items, setItems] = useState<PortfolioItemInput[]>([
		{
			ticker: "__CASH__",
			totalCost: 0,
		},
	])

	const [editingIndex, setEditingIndex] = useState<number | null>(null)
	const [remainingSeconds, setRemainingSeconds] = useState(0)
	const [pendingDeletes, setPendingDeletes] = useState<
		Record<number, { expiresAt: number }>
	>({})
	const [remainingSecondsMap, setRemainingSecondsMap] = useState<
		Record<number, number>
	>({})
	const [priceMap, setPriceMap] = useState<Record<string, number>>({})

	const [provider, setProvider] = useState<LlmProvider>("claude")
	const [strategy, setStrategy] = useState<AnalysisStrategy>("macro")
	const [analysisResult, setAnalysisResult] = useState<string>("")
	const [loading, setLoading] = useState(false)

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
				setItems((prev) =>
					prev.filter((_, index) => !expiredIndexes.includes(index))
				)

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
		const tickers = items
			.map((item) => item.ticker)
			.filter((ticker): ticker is string => !!ticker && ticker !== "__CASH__")

		if (tickers.length === 0) {
			setPriceMap({})
			return
		}

		const loadPrices = async () => {
			try {
				const prices = await fetchPrices(tickers)
				setPriceMap(prices)
			} catch (err) {
				console.error(err)
				setPriceMap({})
			}
		}

		loadPrices()
	}, [items])


	const handleAdd = (item: PortfolioItemInput) => {
		const normalizedTicker = item.ticker.trim().toUpperCase()

		const alreadyExists = items.some(
			(existingItem) => existingItem.ticker === normalizedTicker
		)

		if (alreadyExists) {
			alert("This ticker is already in the portfolio.")
			return
		}

		setItems((prev) => [
			...prev,
			{
				...item,
				ticker: normalizedTicker,
			},
		])
	}

	const handleDelete = (indexToDelete: number) => {
		setPendingDeletes((prev) => ({
			...prev,
			[indexToDelete]: {
				expiresAt: Date.now() + 10000,
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

	const handleUpdate = (indexToUpdate: number, updatedItem: PortfolioItemInput) => {
		setItems((prev) =>
			prev.map((item, index) =>
				index === indexToUpdate ? updatedItem : item
			)
		)
	}

	const handleEdit = (indexToEdit: number) => {
		setEditingIndex(indexToEdit)
	}

	const handleSave = (updatedItem: PortfolioItemInput) => {
		if (editingIndex === null) return

		setItems((prev) =>
			prev.map((item, index) =>
				index === editingIndex ? updatedItem : item
			)
		)

		setEditingIndex(null)
	}

	const handleCancel = () => {
		setEditingIndex(null)
	}

	const editingItem =
		editingIndex !== null ? items[editingIndex] : null

	const calculatedItems = calculatePortfolio(items, priceMap)

	const handleAnalyze = async () => {
		try {
			setLoading(true)
				
			const res = await fetch("/api/analyze", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					provider,
					strategy,
					portfolio: calculatedItems,
				}),
			})

			const data = await res.json()
			//console.log("data",{data})

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
    <main className="p-6 space-y-6">
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
						className={`p-2 px-4 text-white rounded ${
							loading ? "bg-gray-400 cursor-not-allowed" : "bg-purple-600"
						}`}
					>
						{loading ? "Analyzing..." : "Analyze Portfolio"}
					</button>
		
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
									<th className="border p-2 text-left">Current Weight (%)</th>
									<th className="border p-2 text-left">Target Weight (%)</th>
									<th className="border p-2 text-left">Actions</th>
                </tr>
              </thead>

							<tbody>
								{calculatedItems.map((item, index) => {
									const isCash = item.ticker === "__CASH__"
									return (
										<tr key={`${item.ticker}-${index}`} className="hover:bg-gray-50">
											<td className="border p-2 font-medium">{isCash ? "Cash" : item.ticker}</td>

											<td className="border p-2">{isCash ? "N/A": (item.shares ?? "-") }</td>

											<td className="border p-2">
												{isCash ? "N/A" : formatNumber(item.averageBuyPrice)}
											</td>

											<td className="border p-2">
												{formatNumber(item.totalCost)}
											</td>

											<td className="border p-2">
												{isCash ? "N/A" : formatNumber(item.currentPrice)}
											</td>

											<td className="border p-2">
												{isCash ? "N/A" : formatNumber(item.currentValue)}
											</td>

											<td className="border p-2">
												{formatPercent(item.currentWeight)}
											</td>

											<td className="border p-2">
												{formatPercent(item.targetWeight)}
											</td>

											<td className="border p-2">						
												<div className="flex gap-2 justify-center items-center">
													<button
														onClick={() => handleEdit(index)}
														className="p-1 rounded hover:bg-gray-200"
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
															className="p-1 rounded hover:bg-red-100 text-red-600"
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

				<div className="p-4 border rounded bg-gray-50 min-h-[120px] flex items-center justify-center">
					{loading ? (
						<div className="flex flex-col items-center gap-2 text-gray-600">
							<div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
							<span>Analyzing...</span>
						</div>
					) : analysisResult ? (
						<div className="whitespace-pre-wrap">{analysisResult}</div>
					) : (
						<span className="text-gray-400">
							Click "Analyze" to get recommendation
						</span>
					)}
				</div>



      </section>
    </main>
  )
}
