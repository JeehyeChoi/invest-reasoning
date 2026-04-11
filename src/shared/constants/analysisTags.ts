// shared/constants/analysisTags.ts

export type AnalysisTag =
  | "tech"
  | "semiconductor"
  | "ai"
  | "aggressive"
  | "megacap"
  | "defense"
  | "energy"
  | "rate_sensitive"
  | "inflation_hedge"
  | "china_exposure"
  | "consumer"
  | "consumer_staples"
  | "financial"
  | "healthcare"
  | "industrial"
  | "dividend"
  | "cashflow_stable"
  | "cyclical"

export type TagCategory =
  | "sector"
  | "style"
  | "macro"
  | "papic"
  | "valuation"
  | "quality"

export type TagDefinition = {
  id: AnalysisTag
  label: string
  category: TagCategory
  description: string
}

export const TAG_DEFINITIONS: Record<AnalysisTag, TagDefinition> = {
  tech: {
    id: "tech",
    label: "Technology",
    category: "sector",
    description: "Technology-related companies",
  },
  semiconductor: {
    id: "semiconductor",
    label: "Semiconductors",
    category: "sector",
    description: "Chip designers, manufacturers, and equipment companies",
  },
  ai: {
    id: "ai",
    label: "AI Exposure",
    category: "valuation",
    description: "Companies strongly associated with the AI theme",
  },
  aggressive: {
    id: "aggressive",
    label: "Aggressive Growth",
    category: "valuation",
    description: "Higher-volatility growth-oriented exposure",
  },
  megacap: {
    id: "megacap",
    label: "Mega Cap",
    category: "style",
    description: "Very large capitalization companies",
  },
  defense: {
    id: "defense",
    label: "Defense",
    category: "papic",
    description: "Defense and aerospace exposure sensitive to geopolitical conditions",
  },
  energy: {
    id: "energy",
    label: "Energy",
    category: "papic",
    description: "Oil, gas, and energy-linked companies",
  },
  rate_sensitive: {
    id: "rate_sensitive",
    label: "Rate Sensitive",
    category: "macro",
    description: "Companies strongly affected by interest rate changes",
  },
  inflation_hedge: {
    id: "inflation_hedge",
    label: "Inflation Hedge",
    category: "macro",
    description: "Exposure that may benefit from inflationary conditions",
  },
  china_exposure: {
    id: "china_exposure",
    label: "China Exposure",
    category: "papic",
    description: "Companies with meaningful China-linked operational or demand exposure",
  },
  consumer: {
    id: "consumer",
    label: "Consumer",
    category: "sector",
    description: "Consumer-oriented exposure",
  },
  consumer_staples: {
    id: "consumer_staples",
    label: "Consumer Staples",
    category: "sector",
    description: "Staples and defensive consumer exposure",
  },
  financial: {
    id: "financial",
    label: "Financials",
    category: "sector",
    description: "Banks, insurers, payments, and financial services",
  },
  healthcare: {
    id: "healthcare",
    label: "Healthcare",
    category: "sector",
    description: "Healthcare, pharma, and medical exposure",
  },
  industrial: {
    id: "industrial",
    label: "Industrials",
    category: "sector",
    description: "Industrial and infrastructure-linked companies",
  },
  dividend: {
    id: "dividend",
    label: "Dividend",
    category: "quality",
    description: "Companies with meaningful dividend characteristics",
  },
  cashflow_stable: {
    id: "cashflow_stable",
    label: "Stable Cash Flow",
    category: "quality",
    description: "Companies with relatively stable cash generation",
  },
  cyclical: {
    id: "cyclical",
    label: "Cyclical",
    category: "macro",
    description: "Exposure tied to economic cycle sensitivity",
  },
}
