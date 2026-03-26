// src/shared/types/portfolio.ts

export interface PortfolioItemInput {
  ticker: string
  shares?: number
  averageBuyPrice?: number
  totalCost?: number
  targetWeight?: number
}

export interface PriceData {
  ticker: string
  currentPrice: number
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
