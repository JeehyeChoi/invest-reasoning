import { useCallback, useEffect, useState } from "react"

import { CASH_TICKER } from "@/features/portfolio/utils/portfolioConstants"
import { loadPortfolioPrices } from "@/features/portfolio/services/loadPortfolioPrices"
import type { PortfolioItemInput, PriceMap } from "@/shared/portfolio/types"

type StoredPortfolioPrices = {
  priceMap: PriceMap
  priceUpdatedAt: number | null
}

export function usePortfolioPrices(items: PortfolioItemInput[]) {
  const [priceMap, setPriceMap] = useState<PriceMap>({})
  const [priceUpdatedAt, setPriceUpdatedAt] = useState<number | null>(null)
  const [priceError, setPriceError] = useState("")
  const [priceWarning, setPriceWarning] = useState("")
  const [priceLoading, setPriceLoading] = useState(false)
  const [priceLoadingMessage, setPriceLoadingMessage] = useState("")
  const [priceCountdown, setPriceCountdown] = useState<number | null>(null)

  useEffect(() => {
    if (priceCountdown === null || priceCountdown <= 0) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setPriceCountdown((prev) => {
        if (prev === null || prev <= 1) {
          return null
        }

        return prev - 1
      })
    }, 1000)

    return () => window.clearTimeout(timeoutId)
  }, [priceCountdown])

  const restorePortfolioPrices = useCallback(({
    priceMap: nextPriceMap,
    priceUpdatedAt: nextPriceUpdatedAt,
  }: StoredPortfolioPrices) => {
    setPriceMap(nextPriceMap)
    setPriceUpdatedAt(nextPriceUpdatedAt)
  }, [])

  const updatePortfolioPrices = useCallback(async () => {
    const priceItems = items
      .filter((item) => item.ticker && item.ticker !== CASH_TICKER)
      .map((item) => ({
        ticker: item.ticker,
        totalCost: item.totalCost ?? 0,
      }))

    if (priceItems.length === 0) {
      setPriceMap({})
      setPriceUpdatedAt(null)
      setPriceError("")
      setPriceWarning("")
      setPriceLoading(false)
      setPriceLoadingMessage("")
      setPriceCountdown(null)
      return
    }

    setPriceLoading(true)
    setPriceError("")
    setPriceWarning("")
    setPriceCountdown(null)

    try {
      const { prices, failedTickers, warnings, error } = await loadPortfolioPrices({
        items: priceItems,
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
      setPriceCountdown(null)
    }
  }, [items])

  return {
    priceMap,
    priceUpdatedAt,
    priceError,
    priceWarning,
    priceLoading,
    priceLoadingMessage,
    priceCountdown,
    restorePortfolioPrices,
    updatePortfolioPrices,
  }
}
