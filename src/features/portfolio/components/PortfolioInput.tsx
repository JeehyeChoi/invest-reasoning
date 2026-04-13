"use client";

import { TICKERS } from "@/shared/constants/tickers";
import { PortfolioItemInput } from "@/shared/types/portfolio";
import { useEffect, useMemo, useState } from "react";

type PortfolioInputProps = {
  onAdd: (item: PortfolioItemInput) => void;
  onSave?: (item: PortfolioItemInput) => void;
  onCancel?: () => void;
  editingItem?: PortfolioItemInput | null;
  isEditing?: boolean;
};

type EditBasis = "TOTAL_COST" | "AVG_PRICE";

const EDIT_BASIS_STORAGE_KEY = "portfolio-input-edit-basis";

export default function PortfolioInput({
  onAdd,
  onSave,
  onCancel,
  editingItem,
  isEditing = false,
}: PortfolioInputProps) {
  const [ticker, setTicker] = useState("");
  const [shares, setShares] = useState("");
  const [averageBuyPrice, setAverageBuyPrice] = useState("");
  const [totalCost, setTotalCost] = useState("");
  const [targetWeight, setTargetWeight] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [editBasis, setEditBasis] = useState<EditBasis>("TOTAL_COST");

  const normalizedTicker = (editingItem?.ticker ?? ticker).trim().toUpperCase();
  const isCash = normalizedTicker === "__CASH__";

  const hasShares = shares.trim() !== "";
  const hasAverageBuyPrice = averageBuyPrice.trim() !== "";
  const hasTotalCost = totalCost.trim() !== "";
  const hasTargetWeight = targetWeight.trim() !== "";
  const hasAnyPrimaryInput =
    hasShares || hasAverageBuyPrice || hasTotalCost || hasTargetWeight;

  const sharesPlaceholder =
    isEditing && editingItem?.shares !== undefined
      ? String(editingItem.shares.toFixed(2))
      : "Shares";

  const averageBuyPricePlaceholder =
    isEditing && editingItem?.averageBuyPrice !== undefined
      ? String(editingItem.averageBuyPrice.toFixed(2))
      : "Avg Buy Price";

  const totalCostPlaceholder =
    isEditing && editingItem?.totalCost !== undefined
      ? String(editingItem.totalCost.toFixed(2))
      : "Total Cost";

  const isAverageBuyPriceLocked =
    isEditing && !isCash && editBasis === "TOTAL_COST";
  const isTotalCostLocked = isEditing && !isCash && editBasis === "AVG_PRICE";

  const isDisabled = useMemo(() => {
    if (!ticker.trim()) return true;

    if (!isEditing) {
      if (isCash) {
        return !hasTotalCost && !hasTargetWeight;
      }
      return !hasAnyPrimaryInput;
    }

    if (isCash) {
      return !hasTotalCost && !hasTargetWeight;
    }

    const wantsToUpdatePositionValues =
      hasShares || hasAverageBuyPrice || hasTotalCost;

    if (!wantsToUpdatePositionValues) {
      return !hasTargetWeight;
    }

    if (editBasis === "TOTAL_COST") {
      return !hasShares || !hasTotalCost;
    }

    return !hasShares || !hasAverageBuyPrice;
  }, [
    ticker,
    isEditing,
    isCash,
    hasTotalCost,
    hasTargetWeight,
    hasAnyPrimaryInput,
    hasShares,
    hasAverageBuyPrice,
    editBasis,
  ]);

  const query = ticker.trim().toUpperCase();
  const tickerMatches = query
    ? TICKERS.filter((t) => t.ticker.startsWith(query))
    : [];
  const nameMatches = query
    ? TICKERS.filter(
        (t) =>
          !t.ticker.startsWith(query) &&
          t.name.toLowerCase().includes(query.toLowerCase()),
      )
    : [];
  const suggestions = [...tickerMatches, ...nameMatches].slice(0, 20);

  const handleBasisChange = (basis: EditBasis) => {
    setEditBasis(basis);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(EDIT_BASIS_STORAGE_KEY, basis);
    }
  };

  const handleSubmit = () => {
    if (!ticker.trim()) {
      alert("Ticker is required.");
      return;
    }

    if (!isEditing) {
      if (isCash) {
        if (!hasTotalCost && !hasTargetWeight) {
          alert("Provide total cost or target weight to add cash.");
          return;
        }
      } else if (!hasAnyPrimaryInput) {
        alert(
          "Fill at least one of [shares, avg buy price, total cost, target weight].",
        );
        return;
      }
    } else {
      if (isCash) {
        if (!hasTotalCost && !hasTargetWeight) {
          alert("Provide total cost or target weight to update cash.");
          return;
        }
      } else {
        const wantsToUpdatePositionValues =
          hasShares || hasAverageBuyPrice || hasTotalCost;

        if (!wantsToUpdatePositionValues && !hasTargetWeight) {
          alert("Update target weight or at least one position field.");
          return;
        }

        if (wantsToUpdatePositionValues) {
          if (editBasis === "TOTAL_COST" && (!hasShares || !hasTotalCost)) {
            alert("Total cost basis requires both shares and total cost.");
            return;
          }

          if (
            editBasis === "AVG_PRICE" &&
            (!hasShares || !hasAverageBuyPrice)
          ) {
            alert("Avg price basis requires both shares and avg buy price.");
            return;
          }
        }
      }
    }

    const sharesNum = hasShares ? Number(shares) : undefined;
    const avgNum = hasAverageBuyPrice ? Number(averageBuyPrice) : undefined;
    const totalNum = hasTotalCost ? Number(totalCost) : undefined;

    let finalShares = sharesNum;
    let finalAverageBuyPrice = avgNum;
    let finalTotalCost = totalNum;

    if (!isEditing) {
      if (isCash) {
        finalTotalCost = totalNum;
      } else {
        if (finalShares !== undefined && finalAverageBuyPrice !== undefined) {
          finalTotalCost = finalShares * finalAverageBuyPrice;
        } else if (
          finalShares !== undefined &&
          finalTotalCost !== undefined &&
          finalShares !== 0
        ) {
          finalAverageBuyPrice = finalTotalCost / finalShares;
        } else if (
          finalAverageBuyPrice !== undefined &&
          finalTotalCost !== undefined &&
          finalAverageBuyPrice !== 0
        ) {
          finalShares = finalTotalCost / finalAverageBuyPrice;
        }
      }
    } else {
      if (isCash) {
        finalTotalCost =
          totalNum !== undefined ? totalNum : editingItem?.totalCost;
      } else {
        const resolvedShares =
          sharesNum !== undefined ? sharesNum : editingItem?.shares;
        const resolvedAverageBuyPrice =
          avgNum !== undefined ? avgNum : editingItem?.averageBuyPrice;
        const resolvedTotalCost =
          totalNum !== undefined ? totalNum : editingItem?.totalCost;

        if (editBasis === "TOTAL_COST") {
          finalShares = resolvedShares;
          finalTotalCost = resolvedTotalCost;
          finalAverageBuyPrice =
            finalShares !== undefined &&
            finalTotalCost !== undefined &&
            finalShares !== 0
              ? finalTotalCost / finalShares
              : editingItem?.averageBuyPrice;
        } else {
          finalShares = resolvedShares;
          finalAverageBuyPrice = resolvedAverageBuyPrice;
          finalTotalCost =
            finalShares !== undefined && finalAverageBuyPrice !== undefined
              ? finalShares * finalAverageBuyPrice
              : editingItem?.totalCost;
        }
      }
    }

    const item: PortfolioItemInput = isCash
      ? {
          ticker,
          totalCost: finalTotalCost,
          targetWeight: hasTargetWeight ? Number(targetWeight) : undefined,
        }
      : {
          ticker,
          shares: finalShares,
          averageBuyPrice: finalAverageBuyPrice,
          totalCost: finalTotalCost,
          targetWeight: hasTargetWeight ? Number(targetWeight) : undefined,
        };

    if (isEditing && onSave) {
      onSave(item);
    } else {
      onAdd(item);
    }

    setTicker("");
    setShares("");
    setAverageBuyPrice("");
    setTotalCost("");
    setTargetWeight("");
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedBasis = window.localStorage.getItem(EDIT_BASIS_STORAGE_KEY);
    if (savedBasis === "TOTAL_COST" || savedBasis === "AVG_PRICE") {
      setEditBasis(savedBasis);
    }
  }, []);

  useEffect(() => {
    if (editingItem) {
      setTicker(editingItem.ticker);
      setShares("");
      setAverageBuyPrice("");
      setTotalCost("");
      setTargetWeight(
        editingItem.targetWeight !== undefined
          ? String(editingItem.targetWeight)
          : "",
      );
      setShowSuggestions(false);
      setHighlightedIndex(-1);
    } else {
      setTicker("");
      setShares("");
      setAverageBuyPrice("");
      setTotalCost("");
      setTargetWeight("");
      setShowSuggestions(false);
      setHighlightedIndex(-1);
    }
  }, [editingItem]);

  return (
    <div
      className={`space-y-4 rounded border p-4 ${
        isEditing ? "border-green-500 bg-green-50" : "border-gray-300 bg-white"
      }`}
    >
      {isEditing && (
        <div className="space-y-2 rounded border border-green-200 bg-white p-3">
          <p className="text-sm font-medium text-green-700">
            Editing selected portfolio item
          </p>

          {!isCash && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-600">
                Edit basis
              </p>
              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="edit-basis"
                    checked={editBasis === "TOTAL_COST"}
                    onChange={() => handleBasisChange("TOTAL_COST")}
                  />
                  Total cost basis
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="edit-basis"
                    checked={editBasis === "AVG_PRICE"}
                    onChange={() => handleBasisChange("AVG_PRICE")}
                  />
                  Avg price basis
                </label>
              </div>
              <p className="text-xs text-gray-600">
                This choice is remembered for the next edit. In total cost
                basis, avg buy price is auto-calculated. In avg price basis,
                total cost is auto-calculated.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-3 overflow-visible md:grid-cols-2 lg:grid-cols-5">
        <div className="relative self-start">
          <input
            placeholder="Ticker"
            value={ticker}
            onChange={(e) => {
              if (isCash) return;
              setTicker(e.target.value.toUpperCase());
              setShowSuggestions(true);
              setHighlightedIndex(-1);
            }}
            onFocus={() => {
              if (isCash) return;
              if (ticker.trim()) {
                setShowSuggestions(true);
              }
            }}
            onBlur={() => {
              setTimeout(() => setShowSuggestions(false), 100);
            }}
            onKeyDown={(e) => {
              if (isCash) return;
              if (!showSuggestions || suggestions.length === 0) return;

              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlightedIndex((prev) =>
                  prev < suggestions.length - 1 ? prev + 1 : 0,
                );
              }

              if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlightedIndex((prev) =>
                  prev > 0 ? prev - 1 : suggestions.length - 1,
                );
              }

              if (e.key === "Enter" && highlightedIndex >= 0) {
                e.preventDefault();
                setTicker(suggestions[highlightedIndex].ticker);
                setShowSuggestions(false);
                setHighlightedIndex(-1);
              }

              if (e.key === "Escape") {
                setShowSuggestions(false);
                setHighlightedIndex(-1);
              }
            }}
            className={`w-full border p-2 ${
              isCash ? "cursor-not-allowed bg-gray-100 text-gray-500" : ""
            }`}
          />

          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-0 top-full z-50 mt-1 w-full">
              <ul className="max-h-64 w-full overflow-y-auto rounded-md border bg-white shadow-lg">
                {suggestions.map((s, index) => (
                  <li
                    key={s.ticker}
                    onMouseDown={() => {
                      setTicker(s.ticker);
                      setShowSuggestions(false);
                      setHighlightedIndex(-1);
                    }}
                    className={`cursor-pointer border-b p-2 last:border-b-0 ${
                      highlightedIndex === index
                        ? "bg-gray-100"
                        : "hover:bg-gray-100"
                    }`}
                  >
                    {s.ticker} - {s.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <input
          placeholder={sharesPlaceholder}
          type="number"
          step="any"
          value={shares}
          onChange={(e) => {
            if (isCash) return;
            setShares(e.target.value);
          }}
          disabled={isCash}
          className={`w-full border p-2 ${
            isCash ? "cursor-not-allowed bg-gray-100 text-gray-400" : ""
          }`}
        />

        <input
          placeholder={
            isAverageBuyPriceLocked
              ? `${averageBuyPricePlaceholder} (Auto)`
              : averageBuyPricePlaceholder
          }
          type="number"
          step="any"
          value={averageBuyPrice}
          onChange={(e) => {
            if (isCash || isAverageBuyPriceLocked) return;
            setAverageBuyPrice(e.target.value);
          }}
          disabled={isCash || isAverageBuyPriceLocked}
          className={`w-full border p-2 ${
            isCash || isAverageBuyPriceLocked
              ? "cursor-not-allowed bg-gray-100 text-gray-400"
              : ""
          }`}
        />

        <input
          placeholder={
            isTotalCostLocked
              ? `${totalCostPlaceholder} (Auto)`
              : totalCostPlaceholder
          }
          type="number"
          step="any"
          value={totalCost}
          onChange={(e) => {
            if (isTotalCostLocked) return;
            setTotalCost(e.target.value);
          }}
          disabled={isTotalCostLocked}
          className={`w-full border p-2 ${
            isTotalCostLocked
              ? "cursor-not-allowed bg-gray-100 text-gray-400"
              : ""
          }`}
        />

        <input
          placeholder="Target Weight (%)"
          type="number"
          step="any"
          value={targetWeight}
          onChange={(e) => setTargetWeight(e.target.value)}
          className="w-full border p-2"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={isDisabled}
          className={`rounded p-2 px-4 text-white ${
            isDisabled
              ? "cursor-not-allowed bg-gray-400"
              : isEditing
                ? "bg-green-500"
                : "bg-blue-500"
          }`}
        >
          {isEditing ? "Save" : "Add"}
        </button>

        {isEditing && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded border p-2 px-4 hover:bg-gray-100"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
