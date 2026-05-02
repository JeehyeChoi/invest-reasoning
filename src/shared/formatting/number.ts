// src/shared/utils/format.ts

export const formatNumber = (value?: number): string => {
  return value !== undefined ? value.toFixed(2) : "-"
}

export const formatPercent = (value?: number): string => {
  return value !== undefined ? `${value.toFixed(2)}%` : "-"
}
