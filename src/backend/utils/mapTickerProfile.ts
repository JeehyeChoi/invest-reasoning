import type {
  RawTickerProfile,
  TickerClassificationRow,
  TickerMarketDataRow,
  TickerProfileRow,
} from "@/backend/schemas/tickerProfile";

export function mapToProfileRow(raw: RawTickerProfile): TickerProfileRow {
  return {
    ticker: raw.symbol,
    company_name: raw.companyName ?? null,
    description: raw.description ?? null,
    website: raw.website ?? null,
    ceo: raw.ceo ?? null,
    country: raw.country ?? null,
    state: raw.state ?? null,
    city: raw.city ?? null,
    zip: raw.zip ?? null,
    address: raw.address ?? null,
    phone: raw.phone ?? null,
    full_time_employees: raw.fullTimeEmployees
      ? Number(raw.fullTimeEmployees)
      : null,
    ipo_date: raw.ipoDate ?? null,
    source: "fmp",
  };
}

export function mapToClassificationRow(
  raw: RawTickerProfile,
): TickerClassificationRow {
  return {
    ticker: raw.symbol,
    sector: raw.sector ?? null,
    industry: raw.industry ?? null,
    exchange: raw.exchange ?? null,
    exchange_full_name: raw.exchangeFullName ?? null,
    currency: raw.currency ?? null,
    cik: raw.cik ?? null,
    is_etf: raw.isEtf ?? null,
    is_fund: raw.isFund ?? null,
    is_adr: raw.isAdr ?? null,
    is_actively_trading: raw.isActivelyTrading ?? null,
    source: "fmp",
  };
}

export function mapToMarketDataRow(raw: RawTickerProfile): TickerMarketDataRow {
  return {
    ticker: raw.symbol,
    price: raw.price ?? null,
    market_cap: raw.marketCap ?? null,
    beta: raw.beta ?? null,
    last_dividend: raw.lastDividend ?? null,
    fifty_two_week_range: raw.range ?? null,
    price_change: raw.change ?? null,
    price_change_percentage: raw.changePercentage ?? null,
    volume: raw.volume ?? null,
    average_volume: raw.averageVolume ?? null,
  };
}
