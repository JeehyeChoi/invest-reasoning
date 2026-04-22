const AXIS_LABELS: Record<string, string> = {
  fundamentals_based: "Fundamentals",
  etf_implied: "Market-Implied",
  narrative_implied: "Narrative",
};

const MODEL_LABELS: Record<string, string> = {
  heuristic: "Heuristic",
  quantitative: "Quantitative",
  modeling: "Model-Based",
};

export function formatLabel(key: string): string {
  if (AXIS_LABELS[key]) {
    return AXIS_LABELS[key];
  }

  return key
    .replaceAll("_based", "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatModelLabel(key: string): string {
  return MODEL_LABELS[key] ?? formatLabel(key);
}

export function formatMarketCap(value: number | null): string {
  if (value == null || !Number.isFinite(value)) {
    return "-";
  }

  if (value >= 1_000_000_000_000) {
    return `${(value / 1_000_000_000_000).toFixed(2)}T`;
  }

  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`;
  }

  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }

  return value.toLocaleString();
}

export function formatScore(value: number | null): string {
  if (value == null || !Number.isFinite(value)) {
    return "-";
  }

  return value.toFixed(4);
}

export function formatUnknownMetricValue(value: unknown): string {
  if (value == null) {
    return "-";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toFixed(4) : "-";
  }

  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value);
}
