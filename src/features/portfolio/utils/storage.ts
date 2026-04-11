import type { PortfolioItemInput } from "@/shared/types/portfolio"
import type { AnalysisStrategy, LlmProvider } from "@/shared/types/analysis"
import type { PriceMap } from "@/shared/types/portfolio"

const STORAGE_KEY = "geo-portfolio-state"

export type PersistedPortfolioState = {
  version: 1
  items: PortfolioItemInput[]
  provider: LlmProvider
  strategy: AnalysisStrategy
  priceMap: PriceMap
  priceUpdatedAt: number | null
}

export function loadPortfolioState(): PersistedPortfolioState | null {
  if (typeof window === "undefined") return null

  const saved = localStorage.getItem(STORAGE_KEY)
  if (!saved) return null

  try {
    const parsed = JSON.parse(saved) as Partial<PersistedPortfolioState>

    if (!Array.isArray(parsed.items)) {
      return null
    }

    return {
      version: 1,
      items: parsed.items,
      provider: parsed.provider ?? "claude",
      strategy: parsed.strategy ?? "macro",
      priceMap: parsed.priceMap ?? {},
      priceUpdatedAt: parsed.priceUpdatedAt ?? null,
    }
  } catch (error) {
    console.error("Failed to load portfolio state:", error)
    return null
  }
}

export function savePortfolioState(
  state: Omit<PersistedPortfolioState, "version">
): void {
  if (typeof window === "undefined") return

  const payload: PersistedPortfolioState = {
    version: 1,
    items: state.items,
    provider: state.provider,
    strategy: state.strategy,
    priceMap: state.priceMap,
    priceUpdatedAt: state.priceUpdatedAt,
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

export function clearPortfolioState(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(STORAGE_KEY)
}
