import { CASH_TICKER } from "@/features/portfolio/utils/portfolioConstants"
import { calculatePortfolio } from "@/features/portfolio/utils/calculatePortfolio"

type CalculatedPortfolioRow = ReturnType<typeof calculatePortfolio>[number]

export type PortfolioTableRow = CalculatedPortfolioRow & {
  weightGap?: number
  buyOnlyAmount?: number
  buyOnlyShares?: number
}

export function getPortfolioItemCurrentValue(item: CalculatedPortfolioRow) {
  if (item.ticker === CASH_TICKER) {
    return item.totalCost ?? 0
  }

  return item.currentValue ?? 0
}

export function buildPortfolioTableRows(
  calculatedItems: CalculatedPortfolioRow[],
): PortfolioTableRow[] {
  const cashItem = calculatedItems.find((item) => item.ticker === CASH_TICKER)
  const cashCurrentValue = cashItem ? getPortfolioItemCurrentValue(cashItem) : 0
  const cashTargetWeight = cashItem?.targetWeight

  const hasCashTargetWeight = cashTargetWeight !== undefined && cashTargetWeight !== null

  const totalPortfolioValue = calculatedItems.reduce(
    (sum, item) => sum + getPortfolioItemCurrentValue(item),
    0,
  )

  const investableCash = hasCashTargetWeight
    ? Math.max(cashCurrentValue - (cashTargetWeight / 100) * totalPortfolioValue, 0)
    : 0

  const nonCashRows = calculatedItems.filter((item) => item.ticker !== CASH_TICKER)

  const deficitRows = nonCashRows.map((item) => {
    const currentValue = getPortfolioItemCurrentValue(item)
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
        weightGap: (cashItem.currentWeight ?? 0) - (cashItem.targetWeight ?? 0),
        buyOnlyAmount: investableCash > 0 ? -investableCash : 0,
      }
    : undefined

  return cashRow ? [cashRow, ...suggestedRows] : suggestedRows
}
