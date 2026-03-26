"use client"

import { TICKERS } from "@/shared/constants/tickers"
import { PortfolioItemInput } from "@/shared/types/portfolio"
import { useEffect, useState } from "react"

type PortfolioInputProps = {
  onAdd: (item: PortfolioItemInput) => void
  onSave?: (item: PortfolioItemInput) => void
  editingItem?: PortfolioItemInput | null
  isEditing?: boolea
}

export default function PortfolioInput({
  onAdd,
  onSave,
	onCancel,
  editingItem,
  isEditing = false,
}: PortfolioInputProps) {
  const [ticker, setTicker] = useState("")
	const [shares, setShares] = useState("")
	const [averageBuyPrice, setAverageBuyPrice] = useState("")
	const [totalCost, setTotalCost] = useState("")
	const [targetWeight, setTargetWeight] = useState("")
	const [showSuggestions, setShowSuggestions] = useState(false)
	const [highlightedIndex, setHighlightedIndex] = useState(-1)
	const isCash = editingItem?.ticker === "__CASH__"
	const filledCount = [
		shares.trim(),
		averageBuyPrice.trim(),
		totalCost.trim(),
	].filter(Boolean).length

	const sharesPlaceholder =
		isEditing && editingItem?.shares !== undefined
			? String(editingItem.shares.toFixed(2))
			: "Shares"

	const averageBuyPricePlaceholder =
		isEditing && editingItem?.averageBuyPrice !== undefined
			? String(editingItem.averageBuyPrice.toFixed(2))
			: "Avg Buy Price"

	const totalCostPlaceholder =
		isEditing && editingItem?.totalCost !== undefined
			? String(editingItem.totalCost.toFixed(2))
			: "Total Cost"

	const isDisabled = !ticker.trim() || (!isEditing && (isCash ? !totalCost.trim() : filledCount < 2))

	const query = ticker.trim().toUpperCase()
	const tickerMatches = query
		? TICKERS.filter((t) => t.ticker.startsWith(query))
		: []
	const nameMatches = query
		? TICKERS.filter(
				(t) =>
					!t.ticker.startsWith(query) &&
					t.name.toLowerCase().includes(query.toLowerCase())
			)
		: []
	const suggestions = [...tickerMatches, ...nameMatches].slice(0,20)

	const handleSubmit = () => {
		if (!ticker.trim()) {
			alert("Ticker is required.")
			return
		}

		if (!isEditing) {
			if (isCash) {
				if (!totalCost.trim()) {
					alert("Total cost is required for cash.")
					return
				}
			} else if (filledCount < 2) {
				alert("Fill at least two of [shares, unit price, total cost].")
				return
			}
		} else {
			if (isCash) {
				if (!totalCost.trim()) {
					alert("Total cost is required for cash.")
					return
				}
			} else {
				if ((shares.trim() && !totalCost.trim()) || (!shares.trim() && totalCost.trim())) {
					alert("To update position values, fill both shares and total cost.")
					return
				}
			}
		}

		const sharesNum = shares.trim() === "" ? undefined : Number(shares)
		const avgNum = averageBuyPrice.trim() === "" ? undefined : Number(averageBuyPrice)
		const totalNum = totalCost.trim() === "" ? undefined : Number(totalCost)

		let finalShares = sharesNum
		let finalAverageBuyPrice = avgNum
		let finalTotalCost = totalNum

		if (!isCash) {
			if (!isEditing) {
				// add: 3개 중 2개 입력 → 나머지 1개 계산
				if (finalShares !== undefined && finalAverageBuyPrice !== undefined) {
					finalTotalCost = finalShares * finalAverageBuyPrice
				} else if (
					finalShares !== undefined &&
					finalTotalCost !== undefined &&
					finalShares !== 0
				) {
					finalAverageBuyPrice = finalTotalCost / finalShares
				} else if (
					finalAverageBuyPrice !== undefined &&
					finalTotalCost !== undefined &&
					finalAverageBuyPrice !== 0
				) {
					finalShares = finalTotalCost / finalAverageBuyPrice
				}
			} else {
				// edit: shares + totalCost만 수정 가능, avgBP는 자동 계산
				finalShares =
					sharesNum !== undefined ? sharesNum : editingItem?.shares

				finalTotalCost =
					totalNum !== undefined ? totalNum : editingItem?.totalCost

				finalAverageBuyPrice =
					finalShares !== undefined &&
					finalTotalCost !== undefined &&
					finalShares !== 0
						? finalTotalCost / finalShares
						: editingItem?.averageBuyPrice
			}
		}

		const item: PortfolioItemInput = isCash
			? {
					ticker,
					totalCost: totalNum,
					targetWeight: targetWeight.trim() === "" ? undefined : Number(targetWeight),
				}
			: {
					ticker,
					shares: finalShares,
					averageBuyPrice: finalAverageBuyPrice,
					totalCost: finalTotalCost,
					targetWeight: targetWeight.trim() === "" ? undefined : Number(targetWeight),
				}

		if (isEditing && onSave) {
			onSave(item)
		} else {
			onAdd(item)
		}

		setTicker("")
		setShares("")
		setAverageBuyPrice("")
		setTotalCost("")
		setTargetWeight("")
	}

	const handleCancel = () => {
		setTicker("")
		setShares("")
		setAverageBuyPrice("")
		setTotalCost("")
		setTargetWeight("")

		if (onCancel) {
			onCancel()
		}
	}

	useEffect(() => {
		if (editingItem) {
			setTicker(editingItem.ticker)
			setShares("")
			setAverageBuyPrice("")
			setTotalCost("")
			setTargetWeight(
				editingItem.targetWeight !== undefined
					? String(editingItem.targetWeight)
					: ""
			)
			setShowSuggestions(false)
			setHighlightedIndex(-1)
		} else {
			setTicker("")
			setShares("")
			setAverageBuyPrice("")
			setTotalCost("")
			setTargetWeight("")
			setShowSuggestions(false)
			setHighlightedIndex(-1)
		}
	}, [editingItem])

  return (
		<div
			className={`p-4 rounded space-y-4 border ${
				isEditing ? "border-green-500 bg-green-50" : "border-gray-300 bg-white"
			}`}
		>
		{isEditing && (
			<p className="text-sm font-medium text-green-700">
				Editing selected portfolio item
			</p>
		)}
			<div className="grid grid-cols-1 gap-3 items-start overflow-visible md:grid-cols-2 lg:grid-cols-5">
				<div className="relative self-start">
					<input
						placeholder="Ticker"
						value={ticker}
						onChange={(e) => {
							if (isCash) return
      				setTicker(e.target.value.toUpperCase())
      				setShowSuggestions(true)
							setHighlightedIndex(-1)
    				}}
						onFocus={() => {
							if (isCash) return
							if (ticker.trim()) {
								setShowSuggestions(true)
							}
						}}
						onBlur={() => {
							setTimeout(() => setShowSuggestions(false), 100)
						}}

						onKeyDown={(e) => {
							if (isCash) return
							if (!showSuggestions || suggestions.length === 0) return

							if (e.key === "ArrowDown") {
								e.preventDefault()
								setHighlightedIndex((prev) =>
									prev < suggestions.length - 1 ? prev + 1 : 0
								)
							}

							if (e.key === "ArrowUp") {
								e.preventDefault()
								setHighlightedIndex((prev) =>
									prev > 0 ? prev - 1 : suggestions.length - 1
								)
							}

							if (e.key === "Enter" && highlightedIndex >= 0) {
								e.preventDefault()
								setTicker(suggestions[highlightedIndex].ticker)
								setShowSuggestions(false)
								setHighlightedIndex(-1)
							}

							if (e.key === "Escape") {
								setShowSuggestions(false)
								setHighlightedIndex(-1)
							}
						}}

						className={`border p-2 w-full ${
							isCash ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""
						}`}	
					/>

					{showSuggestions && suggestions.length > 0 && (
					  <div className="absolute left-0 top-full z-50 mt-1 w-full">
							<ul className="max-h-64 w-full overflow-y-auto rounded-md border bg-white shadow-lg">
								{suggestions.map((s, index) => (
									<li
										key={s.ticker}
										onMouseDown={() => {
											setTicker(s.ticker)
											setShowSuggestions(false)
											setHighlightedIndex(-1)
										}}
										className={`cursor-pointer border-b p-2 last:border-b-0 ${
											highlightedIndex === index ? "bg-gray-100" : "hover:bg-gray-100"
										}`}
									>
										{s.ticker} - {s.name}
									</li>
								))}
							</ul>
						</div>
					)}
				</div>

				<input
					placeholder={sharesPlaceholder}
					type="number"
					step="any"
					value={shares}
					onChange={(e) => {
						if (isCash) return
						setShares(e.target.value)
					}}
					disabled={isCash}
					className={`border p-2 w-full ${
						isCash ? "bg-gray-100 text-gray-400 cursor-not-allowed" : ""
					}`}
				/>

				<input
					placeholder={averageBuyPricePlaceholder}
					type="number"
  				step="any"
					value={averageBuyPrice}
					onChange={(e) => {
						if (isCash) return
						setAverageBuyPrice(e.target.value)
					}}
					disabled={isCash}
					className={`border p-2 w-full ${
						isCash ? "bg-gray-100 text-gray-400 cursor-not-allowed" : ""
					}`}
				/>

				<input
					placeholder={totalCostPlaceholder}
					type="number"
					value={totalCost}
					onChange={(e) => {
						setTotalCost(e.target.value)
					}}
					className="border p-2 w-full"
				/>

				<input
					placeholder="Target Weight (%)"
					type="number"
					value={targetWeight}
					onChange={(e) => setTargetWeight(e.target.value)}
					className="border p-2 w-full"
				/>
			</div>

			<div className="flex gap-2">
				<button
					onClick={handleSubmit}
					disabled={isDisabled}
					className={`p-2 px-4 text-white rounded ${
						isDisabled
							? "bg-gray-400 cursor-not-allowed"
							: isEditing
							? "bg-green-500"
							: "bg-blue-500"
					}`}
				>
					{isEditing ? "Save" : "Add"}
				</button>

				{isEditing && (
					<button
						type="button"
						onClick={onCancel}
						className="p-2 px-4 border rounded hover:bg-gray-100"
					>
						Cancel
					</button>
				)}
			</div>

		</div>
  )
}
