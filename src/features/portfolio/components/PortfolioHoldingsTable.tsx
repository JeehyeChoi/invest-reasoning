import Link from "next/link"
import { Pencil, RotateCcw, Trash2 } from "lucide-react"

import { formatNumber, formatPercent } from "@/shared/formatting/number"
import { CASH_TICKER, BUY_ONLY_TOLERANCE } from "@/features/portfolio/utils/portfolioConstants"
import {
  getPortfolioItemCurrentValue,
  type PortfolioTableRow,
} from "@/features/portfolio/utils/buildPortfolioTableRows"

type PortfolioHoldingsTableProps = {
  items: PortfolioTableRow[]
  priceLoading: boolean
  pendingDeletes: Record<number, { expiresAt: number }>
  remainingSecondsMap: Record<number, number>
  onEdit: (index: number) => void
  onDelete: (index: number) => void
  onUndoDelete: (index: number) => void
}

export function PortfolioHoldingsTable({
  items,
  priceLoading,
  pendingDeletes,
  remainingSecondsMap,
  onEdit,
  onDelete,
  onUndoDelete,
}: PortfolioHoldingsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border border-gray-300 text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="border p-2 text-left">Ticker</th>
            <th className="border p-2 text-left">Shares</th>
            <th className="border p-2 text-left">Avg. Buy Price</th>
            <th className="border p-2 text-left">Total Cost</th>
            <th className="border p-2 text-left">Current Price</th>
            <th className="border p-2 text-left">Current Value</th>
            <th className="border p-2 text-left">Current Weight</th>
            <th className="border p-2 text-left">Target Weight</th>
            <th className="border p-2 text-left">Buy Only</th>
            <th className="border p-2 text-left">Actions</th>
          </tr>
        </thead>

        <tbody>
          {items.map((item, index) => {
            const isCash = item.ticker === CASH_TICKER
            const weightGap = item.weightGap ?? 0
            const gapLabel =
              weightGap > 0
                ? ` (+${formatPercent(weightGap)})`
                : weightGap < 0
                  ? ` (${formatPercent(weightGap)})`
                  : ""

            return (
              <tr key={`${item.ticker}-${index}`} className="hover:bg-gray-50">
                <td className="border p-2 font-medium">
                  {isCash ? (
                    "Cash"
                  ) : (
                    <Link
                      href={`/tickers/${item.ticker}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cursor-pointer underline underline-offset-2 hover:text-blue-600"
                    >
                      {item.ticker}
                    </Link>
                  )}
                </td>

                <td className="border p-2">{isCash ? "N/A" : item.shares ?? "-"}</td>

                <td className="border p-2">
                  {isCash ? "N/A" : formatNumber(item.averageBuyPrice)}
                </td>

                <td className="border p-2">{formatNumber(item.totalCost)}</td>

                <td className="border p-2">
                  {isCash
                    ? "N/A"
                    : item.currentPrice != null
                      ? formatNumber(item.currentPrice)
                      : priceLoading
                        ? "Processing..."
                        : "-"}
                </td>

                <td className="border p-2">{formatNumber(getPortfolioItemCurrentValue(item))}</td>

                <td className="border p-2">
                  {formatPercent(item.currentWeight)}
                  {gapLabel && (
                    <span
                      className={`ml-1 text-xs ${
                        weightGap > 0 ? "text-amber-700" : "text-blue-700"
                      }`}
                    >
                      {gapLabel}
                    </span>
                  )}
                </td>

                <td className="border p-2">{formatPercent(item.targetWeight)}</td>

                <td className="border p-2">
                  {isCash ? (
                    item.buyOnlyAmount && item.buyOnlyAmount < 0 ? (
                      <span className="text-amber-700">
                        Reserve {formatNumber(Math.abs(item.buyOnlyAmount))}
                      </span>
                    ) : (
                      "-"
                    )
                  ) : Math.abs(weightGap) <= BUY_ONLY_TOLERANCE ? (
                    <span className="text-emerald-700">On target</span>
                  ) : item.buyOnlyAmount && item.buyOnlyAmount > 0 ? (
                    <div className="space-y-1">
                      <div className="text-blue-700">
                        Buy {formatNumber(item.buyOnlyAmount)}
                      </div>
                      {item.buyOnlyShares !== undefined && (
                        <div className="text-xs text-gray-500">
                          ≈ {formatNumber(item.buyOnlyShares)} shares
                        </div>
                      )}
                    </div>
                  ) : weightGap > 0 ? (
                    <span className="text-amber-700">Overweight</span>
                  ) : (
                    <span className="text-blue-700">Rebalancing needed</span>
                  )}
                </td>

                <td className="border p-2">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => onEdit(index)}
                      className="rounded p-1 hover:bg-gray-200"
                      title="Edit"
                      disabled={!!pendingDeletes[index]}
                    >
                      <Pencil size={16} />
                    </button>

                    {pendingDeletes[index] ? (
                      <button
                        onClick={() => onUndoDelete(index)}
                        className="flex items-center gap-1 rounded px-2 py-1 text-amber-700 hover:bg-amber-100"
                        title="Undo delete"
                      >
                        <RotateCcw size={16} />
                        <span className="text-xs">{remainingSecondsMap[index] ?? 0}s</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => onDelete(index)}
                        className="rounded p-1 text-red-600 hover:bg-red-100"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
