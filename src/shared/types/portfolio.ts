// src/shared/types/portfolio.ts

export type PriceMap = Record<string, number>

export interface PortfolioItemInput {
  ticker: string
  shares?: number
  averageBuyPrice?: number
  totalCost?: number
  targetWeight?: number
}

export interface PortfolioItemComputed {
  ticker: string
  shares?: number
  averageBuyPrice?: number
  totalCost?: number
  currentPrice?: number
  currentValue?: number
  currentWeight?: number
  targetWeight?: number
}
