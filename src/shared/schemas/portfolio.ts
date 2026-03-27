import { z } from "zod"

export const PortfolioItemComputedSchema = z.object({
  ticker: z.string(),
  shares: z.number().finite().optional(),
  averageBuyPrice: z.number().finite().optional(),
  totalCost: z.number().finite().optional(),
  currentPrice: z.number().finite().optional(),
  currentValue: z.number().finite().optional(),
  currentWeight: z.number().finite().optional(),
  targetWeight: z.number().finite().optional(),
})

export type PortfolioItemComputedParsed = z.infer<typeof PortfolioItemComputedSchema>
