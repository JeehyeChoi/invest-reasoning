type PortfolioPriceStatusPanelProps = {
  priceUpdatedAt: number | null
  priceLoadingMessage: string
  priceCountdown: number | null
  priceError: string
  priceWarning: string
}

export function PortfolioPriceStatusPanel({
  priceUpdatedAt,
  priceLoadingMessage,
  priceCountdown,
  priceError,
  priceWarning,
}: PortfolioPriceStatusPanelProps) {
  return (
    <>
      <div className="mt-2 text-sm text-gray-500">
        {priceUpdatedAt
          ? `Prices updated: ${new Date(priceUpdatedAt).toLocaleString("en-US")}`
          : "Prices not loaded yet."}
      </div>

      {priceLoadingMessage && (
        <div className="mt-1 text-sm text-slate-600">
          {priceCountdown !== null
            ? `Loading prices... Next batch in ${priceCountdown}s...`
            : priceLoadingMessage}
        </div>
      )}

      {priceError && (
        <div className="mt-1 whitespace-pre-line text-sm text-red-600">
          {priceError}
        </div>
      )}

      {priceWarning && (
        <div className="mt-1 whitespace-pre-line text-sm text-amber-600">
          {priceWarning}
        </div>
      )}
    </>
  )
}
