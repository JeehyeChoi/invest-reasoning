import type { RawTickerProfile, TickerTagRow } from "@/backend/schemas/tickers/tickerProfile";

const SECTOR_TAG_MAP: Record<string, string> = {
  Technology: "tech",
  Healthcare: "healthcare",
  "Financial Services": "financial",
  Energy: "energy",
  Industrials: "industrial",
  Utilities: "utilities",
  "Consumer Defensive": "consumer_staples",
  "Consumer Cyclical": "consumer",
  "Communication Services": "communication",
  "Basic Materials": "materials",
  "Real Estate": "real_estate",
};

const INDUSTRY_EXACT_TAG_MAP: Record<string, string> = {
  Semiconductors: "semiconductor",
  Biotechnology: "biotech",
  Banks: "banking",
  Insurance: "insurance",
  Utilities: "utilities",
  "Aerospace & Defense": "defense",
  "Software - Infrastructure": "software",
  "Software - Application": "software",
  "Consumer Electronics": "hardware",
  "Medical Devices": "medical",
  "Drug Manufacturers - General": "pharma",
  "Drug Manufacturers - Specialty & Generic": "pharma",
};

function addTag(
  tags: TickerTagRow[],
  tag: string | null,
  sourceRule: string | null,
) {
  if (!tag) return;

  const exists = tags.some((item) => item.tag === tag);
  if (exists) return;

  tags.push({
    tag,
    source_rule: sourceRule,
  });
}

function normalizeText(value?: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

function getMarketCapTag(marketCap?: number | null): {
  tag: string | null;
  sourceRule: string | null;
} {
  if (!marketCap || marketCap <= 0) {
    return { tag: null, sourceRule: null };
  }

  if (marketCap >= 200_000_000_000) {
    return { tag: "megacap", sourceRule: "marketCap>=200B" };
  }

  if (marketCap >= 10_000_000_000) {
    return { tag: "largecap", sourceRule: "10B<=marketCap<200B" };
  }

  if (marketCap >= 2_000_000_000) {
    return { tag: "midcap", sourceRule: "2B<=marketCap<10B" };
  }

  return { tag: "smallcap", sourceRule: "marketCap<2B" };
}

function getBetaTag(beta?: number | null): {
  tag: string | null;
  sourceRule: string | null;
} {
  if (beta == null || Number.isNaN(beta)) {
    return { tag: null, sourceRule: null };
  }

  if (beta < 0.8) {
    return { tag: "low_beta", sourceRule: "beta<0.8" };
  }

  if (beta <= 1.2) {
    return { tag: "mid_beta", sourceRule: "0.8<=beta<=1.2" };
  }

  return { tag: "high_beta", sourceRule: "beta>1.2" };
}

function getDividendTag(
  lastDividend?: number | null,
  price?: number | null,
): {
  tag: string;
  sourceRule: string;
} {
  if (!lastDividend || lastDividend <= 0 || !price || price <= 0) {
    return {
      tag: "non_dividend",
      sourceRule: "lastDividend<=0_or_price<=0",
    };
  }

  const estimatedYield = (lastDividend * 4) / price;

  if (estimatedYield < 0.02) {
    return {
      tag: "low_dividend",
      sourceRule: "estimatedDividendYield<2pct",
    };
  }

  if (estimatedYield < 0.05) {
    return {
      tag: "mid_dividend",
      sourceRule: "2pct<=estimatedDividendYield<5pct",
    };
  }

  return {
    tag: "high_dividend",
    sourceRule: "estimatedDividendYield>=5pct",
  };
}

function inferSectorTags(raw: RawTickerProfile, tags: TickerTagRow[]) {
  const sector = raw.sector ?? "";
  if (!sector) return;

  const mappedTag = SECTOR_TAG_MAP[sector];
  if (mappedTag) {
    addTag(tags, mappedTag, `sector=${sector}`);
  }
}

function inferIndustryTags(raw: RawTickerProfile, tags: TickerTagRow[]) {
  const industry = raw.industry ?? "";
  if (!industry) return;

  const normalizedIndustry = normalizeText(industry);

  const exactTag = INDUSTRY_EXACT_TAG_MAP[industry];
  if (exactTag) {
    addTag(tags, exactTag, `industry=${industry}`);
  }

  if (normalizedIndustry.includes("software")) {
    addTag(tags, "software", `industry~${industry}`);
  }

  if (normalizedIndustry.includes("oil") || normalizedIndustry.includes("gas")) {
    addTag(tags, "oil_gas", `industry~${industry}`);
  }

  if (normalizedIndustry.includes("banks") || normalizedIndustry.includes("bank")) {
    addTag(tags, "banking", `industry~${industry}`);
  }

  if (normalizedIndustry.includes("insurance")) {
    addTag(tags, "insurance", `industry~${industry}`);
  }

  if (normalizedIndustry.includes("medical")) {
    addTag(tags, "medical", `industry~${industry}`);
  }

  if (
    normalizedIndustry.includes("aerospace") ||
    normalizedIndustry.includes("defense")
  ) {
    addTag(tags, "defense", `industry~${industry}`);
  }

  if (
    normalizedIndustry.includes("electronic") ||
    normalizedIndustry.includes("hardware")
  ) {
    addTag(tags, "hardware", `industry~${industry}`);
  }
}

function inferCountryTags(raw: RawTickerProfile, tags: TickerTagRow[]) {
  if (!raw.country) return;

  if (raw.country === "US") {
    addTag(tags, "us_listed", "country=US");
  } else {
    addTag(tags, "non_us", `country=${raw.country}`);
  }

  if (raw.country === "CN") {
    addTag(tags, "china_exposure", "country=CN");
  }
}

function inferStructureTags(raw: RawTickerProfile, tags: TickerTagRow[]) {
  if (raw.isAdr === true) {
    addTag(tags, "adr", "isAdr=true");
  }

  if (raw.isEtf === true) {
    addTag(tags, "etf", "isEtf=true");
  }

  if (raw.isFund === true) {
    addTag(tags, "fund", "isFund=true");
  }

  if (raw.isActivelyTrading === true) {
    addTag(tags, "actively_trading", "isActivelyTrading=true");
  }
}

function inferDescriptionTags(raw: RawTickerProfile, tags: TickerTagRow[]) {
  const description = normalizeText(raw.description);
  if (!description) return;

  if (description.includes("artificial intelligence") || description.includes(" ai ")) {
    addTag(tags, "ai", "description~ai");
  }

  if (description.includes("data center")) {
    addTag(tags, "data_center", "description~data_center");
  }

  if (description.includes("cloud")) {
    addTag(tags, "cloud", "description~cloud");
  }

  if (description.includes("cybersecurity")) {
    addTag(tags, "cybersecurity", "description~cybersecurity");
  }

  if (description.includes("robotics")) {
    addTag(tags, "robotics", "description~robotics");
  }

  if (description.includes("defense")) {
    addTag(tags, "defense", "description~defense");
  }

  if (
    description.includes("electric power") ||
    description.includes("power generation") ||
    description.includes("grid")
  ) {
    addTag(tags, "power_infra", "description~power_infra");
  }

  if (
    description.includes("consumer") ||
    description.includes("retail") ||
    description.includes("e-commerce")
  ) {
    addTag(tags, "consumer", "description~consumer");
  }
}

export function inferTickerTags(raw: RawTickerProfile): TickerTagRow[] {
  const tags: TickerTagRow[] = [];

  inferSectorTags(raw, tags);
  inferIndustryTags(raw, tags);
  inferCountryTags(raw, tags);
  inferStructureTags(raw, tags);
  inferDescriptionTags(raw, tags);

  const marketCapTag = getMarketCapTag(raw.marketCap);
  addTag(tags, marketCapTag.tag, marketCapTag.sourceRule);

  const betaTag = getBetaTag(raw.beta);
  addTag(tags, betaTag.tag, betaTag.sourceRule);

  const dividendTag = getDividendTag(raw.lastDividend, raw.price);
  addTag(tags, dividendTag.tag, dividendTag.sourceRule);

  return tags;
}
