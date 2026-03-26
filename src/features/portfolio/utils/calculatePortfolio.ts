import { PortfolioItemInput } from "@/shared/types/portfolio"
import { completePortfolioItem } from "@/features/portfolio/utils/completePortfolioItem"

type CalculatedPortfolioItem = PortfolioItemInput & {
  currentPrice?: number
  currentValue?: number
  currentWeight?: number
}

export const calculatePortfolio = (
  items: PortfolioItemInput[],
  priceMap: Record<string, number>
): CalculatedPortfolioItem[] => {
  const completedItems = items.map((item) => {
    const completed = completePortfolioItem(item)

    const isCash = completed.ticker === "__CASH__"

    const currentPrice = isCash ? 1 : priceMap[completed.ticker]

    const currentValue = isCash
      ? completed.totalCost
      : completed.shares !== undefined && currentPrice !== undefined
        ? completed.shares * currentPrice
        : undefined

    return {
      ...completed,
      currentPrice,
      currentValue,
    }
  })

  const totalCurrentValue = completedItems.reduce(
    (sum, item) => sum + (item.currentValue ?? 0),
    0
  )

  return completedItems.map((item) => ({
    ...item,
    currentWeight:
      item.currentValue !== undefined && totalCurrentValue > 0
        ? (item.currentValue / totalCurrentValue) * 100
        : undefined,
  }))
}
