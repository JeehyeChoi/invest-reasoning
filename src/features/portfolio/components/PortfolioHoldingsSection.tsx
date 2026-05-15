import type { PortfolioItemInput } from "@/shared/portfolio/types"
import { PortfolioHoldingsTable } from "@/features/portfolio/components/PortfolioHoldingsTable"
import { PortfolioPriceStatusPanel } from "@/features/portfolio/components/PortfolioPriceStatusPanel"
import type { PortfolioTableRow } from "@/features/portfolio/utils/buildPortfolioTableRows"

type PortfolioHoldingsSectionProps = {
  items: PortfolioItemInput[]
  tableItems: PortfolioTableRow[]
  priceUpdatedAt: number | null
  priceLoading: boolean
  priceLoadingMessage: string
  priceCountdown: number | null
  priceError: string
  priceWarning: string
  hasPriceTickers: boolean
  analysisLoading: boolean
  pendingDeletes: Record<number, { expiresAt: number }>
  remainingSecondsMap: Record<number, number>
  onUpdatePrices: () => void
  onAnalyze: () => void
  onEdit: (index: number) => void
  onDelete: (index: number) => void
  onUndoDelete: (index: number) => void
}

export function PortfolioHoldingsSection({
  items,
  tableItems,
  priceUpdatedAt,
  priceLoading,
  priceLoadingMessage,
  priceCountdown,
  priceError,
  priceWarning,
  hasPriceTickers,
  analysisLoading,
  pendingDeletes,
  remainingSecondsMap,
  onUpdatePrices,
  onAnalyze,
  onEdit,
  onDelete,
  onUndoDelete,
}: PortfolioHoldingsSectionProps) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Current Inputs</h2>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onUpdatePrices}
            disabled={priceLoading || !hasPriceTickers}
            className={`rounded p-2 px-4 text-white ${
              priceLoading || !hasPriceTickers
                ? "cursor-not-allowed bg-gray-400"
                : "bg-blue-600"
            }`}
          >
            {priceLoading ? "Updating Prices..." : "Update Prices"}
          </button>

          <button
            type="button"
            onClick={onAnalyze}
            disabled={analysisLoading}
            className={`rounded p-2 px-4 text-white ${
              analysisLoading ? "cursor-not-allowed bg-gray-400" : "bg-purple-600"
            }`}
          >
            {analysisLoading ? "Analyzing..." : "Analyze Portfolio"}
          </button>
        </div>
      </div>

      <PortfolioPriceStatusPanel
        priceUpdatedAt={priceUpdatedAt}
        priceLoadingMessage={priceLoadingMessage}
        priceCountdown={priceCountdown}
        priceError={priceError}
        priceWarning={priceWarning}
      />

      <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
        Buy Only suggestions use excess cash above the cash target weight. Cash target weight is required for this view.
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-gray-500">No portfolio items yet.</p>
      ) : (
        <PortfolioHoldingsTable
          items={tableItems}
          priceLoading={priceLoading}
          pendingDeletes={pendingDeletes}
          remainingSecondsMap={remainingSecondsMap}
          onEdit={onEdit}
          onDelete={onDelete}
          onUndoDelete={onUndoDelete}
        />
      )}
    </section>
  )
}
