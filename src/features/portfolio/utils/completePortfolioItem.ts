import { PortfolioItemInput } from "@/shared/types/portfolio"

export const completePortfolioItem = (item: PortfolioItemInput) => {
  let { shares, averageBuyPrice, totalCost } = item

  if (shares && averageBuyPrice && !totalCost) {
    totalCost = shares * averageBuyPrice
  }

  if (shares && totalCost && !averageBuyPrice) {
    averageBuyPrice = totalCost / shares
  }

  if (averageBuyPrice && totalCost && !shares) {
    shares = totalCost / averageBuyPrice
  }

  return {
    ...item,
    shares,
    averageBuyPrice,
    totalCost,
  }
}
