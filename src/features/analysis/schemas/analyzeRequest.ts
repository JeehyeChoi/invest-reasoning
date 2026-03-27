import { z } from "zod"
import { PortfolioItemComputedSchema } from "@/shared/schemas/portfolio"

export const AnalyzeRequestSchema = z.object({
  provider: z.enum(["claude", "openai"]),
  strategy: z.enum(["papic", "macro", "valuation"]),
  portfolio: z.array(PortfolioItemComputedSchema).min(1),
})

export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>
