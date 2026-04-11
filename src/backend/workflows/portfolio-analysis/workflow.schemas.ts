import { z } from "zod"

export const portfolioItemComputedSchema = z.object({
  ticker: z.string().min(1),
  shares: z.number().optional(),
  averageBuyPrice: z.number().optional(),
  totalCost: z.number().optional(),
  currentPrice: z.number().optional(),
  currentValue: z.number().optional(),
  currentWeight: z.number().optional(),
  targetWeight: z.number().optional(),
})

export const portfolioAnalysisWorkflowInputSchema = z.object({
  provider: z.enum(["claude", "openai"]),
  strategy: z.enum(["papic", "macro", "valuation"]),
  calculatedPortfolio: z.array(portfolioItemComputedSchema),
})


