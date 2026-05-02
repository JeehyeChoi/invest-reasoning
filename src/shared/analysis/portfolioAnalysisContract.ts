import { z } from "zod";

import { PortfolioItemComputedSchema } from "@/shared/portfolio/schema";

export const PortfolioAnalysisRequestSchema = z.object({
  provider: z.enum(["claude", "openai"]),
  strategy: z.enum(["papic", "macro", "valuation"]),
  calculatedPortfolio: z.array(PortfolioItemComputedSchema).min(1),
});

export type PortfolioAnalysisRequest = z.infer<
  typeof PortfolioAnalysisRequestSchema
>;
