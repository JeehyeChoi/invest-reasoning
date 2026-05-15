"use client"

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react"

import { PortfolioItemInput } from "@/shared/portfolio/types"
import type { LlmProvider, AnalysisStrategy } from "@/shared/analysis/types"
import type { PortfolioAnalysisRequest } from "@/shared/analysis/portfolioAnalysisContract"

import PortfolioInput from "@/features/portfolio/components/PortfolioInput"
import { PortfolioHoldingsSection } from "@/features/portfolio/components/PortfolioHoldingsSection"
import { calculatePortfolio } from "@/features/portfolio/utils/calculatePortfolio"
import { loadPortfolioState, savePortfolioState } from "@/features/portfolio/utils/storage"
import { CASH_TICKER } from "@/features/portfolio/utils/portfolioConstants"
import { buildPortfolioTableRows } from "@/features/portfolio/utils/buildPortfolioTableRows"
import { usePortfolioPrices } from "@/features/portfolio/hooks/usePortfolioPrices"

import { AnalysisResult } from "@/features/analysis/components/AnalysisResult"
import { AnalysisLoading } from "@/features/analysis/components/AnalysisLoading"
import { analyzePortfolio } from "@/features/analysis/services/analyzePortfolio"
import { RecentSecDisclosuresPanel } from "@/features/disclosures/sec/components/RecentSecDisclosuresPanel"
import { MarketStatus } from "@/features/market/components/MarketStatus"

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

  const [provider, setProvider] = useState<LlmProvider>("claude")
  const [strategy, setStrategy] = useState<AnalysisStrategy>("papic")
  const [analysisResult, setAnalysisResult] = useState<unknown | null>(null)
  const [loading, setLoading] = useState(false)
  const [hasLoadedPortfolioState, setHasLoadedPortfolioState] = useState(false)

  const hasShownCashTargetWeightAlert = useRef(false)
  const {
    priceMap,
    priceUpdatedAt,
    priceError,
    priceWarning,
    priceLoading,
    priceLoadingMessage,
    priceCountdown,
    restorePortfolioPrices,
    updatePortfolioPrices,
  } = usePortfolioPrices(items)

  useEffect(() => {
    const saved = loadPortfolioState()
    if (!saved) {
      setHasLoadedPortfolioState(true)
      return
    }

    setItems(saved.items)
    setProvider(saved.provider)
    setStrategy(saved.strategy)
    restorePortfolioPrices({
      priceMap: saved.priceMap,
      priceUpdatedAt: saved.priceUpdatedAt,
    })
    setHasLoadedPortfolioState(true)
  }, [restorePortfolioPrices])

  useEffect(() => {
    if (!hasLoadedPortfolioState) return

    savePortfolioState({
      items,
      provider,
      strategy,
      priceMap,
      priceUpdatedAt,
    })
  }, [hasLoadedPortfolioState, items, provider, strategy, priceMap, priceUpdatedAt])

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

  const tableItems = useMemo(
    () => buildPortfolioTableRows(calculatedItems),
    [calculatedItems],
  )

	const watchlistTickers = useMemo(() => {
		return Array.from(
			new Set(
				items
					.map((item) => item.ticker?.trim().toUpperCase())
					.filter((ticker): ticker is string => !!ticker && ticker !== CASH_TICKER)
			)
		);
	}, [items]);

	const hasPriceTickers = watchlistTickers.length > 0

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

      const payload: PortfolioAnalysisRequest = {
        provider,
        strategy,
        calculatedPortfolio: calculatedItems,
      }

      const data = await analyzePortfolio(payload)

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

			<div className="mt-3 border border-black bg-[#f4f4f4] p-3 text-sm">
				<p className="text-gray-800">
					Review market-level views and methodology notes.
				</p>

				<div className="mt-2 flex gap-4">
					<Link
						href="/analyst"
						target="_blank"
						rel="noopener noreferrer"
						className="font-bold underline"
					>
						  Analyst console →
					</Link>
					<Link
						href="/macro"
						target="_blank"
						rel="noopener noreferrer"
						className="font-bold underline"
					>
						  Macro data →
					</Link>
					<Link
						href="/market/cluster/overview"
						target="_blank"
						rel="noopener noreferrer"
						className="font-bold underline"
					>
						  Market cluster overview →
					</Link>
					<Link
						href="/signal-validation"
						target="_blank"
						rel="noopener noreferrer"
						className="font-bold underline"
					>
						  Signal validation →
					</Link>
					<Link
						href="/methodology"
						target="_blank"
						rel="noopener noreferrer"
						className="font-bold underline"
					>
						  Read the methodology →
					</Link>
				</div>
			</div>

      <PortfolioInput
        onAdd={handleAdd}
        onSave={handleSave}
        onCancel={handleCancel}
        editingItem={editingItem}
        isEditing={editingIndex !== null}
      />

      <PortfolioHoldingsSection
        items={items}
        tableItems={tableItems}
        priceUpdatedAt={priceUpdatedAt}
        priceLoading={priceLoading}
        priceLoadingMessage={priceLoadingMessage}
        priceCountdown={priceCountdown}
        priceError={priceError}
        priceWarning={priceWarning}
        hasPriceTickers={hasPriceTickers}
        analysisLoading={loading}
        pendingDeletes={pendingDeletes}
        remainingSecondsMap={remainingSecondsMap}
        onUpdatePrices={updatePortfolioPrices}
        onAnalyze={handleAnalyze}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onUndoDelete={handleUndoDelete}
      />

				<MarketStatus />

				<div className="mt-6">
					<RecentSecDisclosuresPanel tickers={watchlistTickers} />
				</div>

        <div className="flex min-h-[120px] items-center justify-center rounded border bg-gray-50 p-4">
          {loading ? (
            <AnalysisLoading />
          ) : analysisResult ? (
            <AnalysisResult result={analysisResult} />
          ) : (
            <span className="text-gray-400">Click Analyze to get recommendation</span>
          )}
        </div>


    </main>
  )
}
