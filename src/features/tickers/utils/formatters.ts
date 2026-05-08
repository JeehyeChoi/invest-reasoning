const AXIS_LABELS: Record<string, string> = {
  fundamentals_based: "Fundamentals",
  market_price: "Market Price",
  valuation: "Valuation",
  macro_linked: "Macro Linked",
  etf_exposure: "ETF Exposure",
  narrative_implied: "Narrative",
};

export function formatLabel(key: string): string {
  if (AXIS_LABELS[key]) {
    return AXIS_LABELS[key];
  }

  return key
    .replaceAll("_based", "")
    .replaceAll("_", " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
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

export function formatFeatureValue(value: number | null): string {
  if (value == null || !Number.isFinite(value)) {
    return "-";
  }

  const abs = Math.abs(value);

  if (abs <= 5) {
    return `${(value * 100).toFixed(1)}%`;
  }

  return value.toFixed(2);
}

export function formatCompactValue(value: number | null): string {
  if (value == null || !Number.isFinite(value)) {
    return "-";
  }

  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);

  if (abs >= 1_000_000_000_000) {
    return `${sign}${(abs / 1_000_000_000_000).toFixed(2)}T`;
  }

  if (abs >= 1_000_000_000) {
    return `${sign}${(abs / 1_000_000_000).toFixed(2)}B`;
  }

  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toFixed(2)}M`;
  }

  if (abs >= 1_000) {
    return `${sign}${(abs / 1_000).toFixed(2)}K`;
  }

  return value.toFixed(2);
}

export function formatPercentile(value: number | null): string {
  if (value == null || !Number.isFinite(value)) {
    return "-";
  }

  return `${Math.round(value * 100)}th`;
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

export function formatInteger(value?: number | null): string {
  if (value == null) return "—";
  return value.toLocaleString("en-US");
}
