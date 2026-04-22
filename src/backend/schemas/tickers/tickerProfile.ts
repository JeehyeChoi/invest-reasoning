export type RawTickerProfile = {
  symbol: string;
  price?: number;
  marketCap?: number;
  beta?: number;
  lastDividend?: number;
  range?: string;
  change?: number;
  changePercentage?: number;
  volume?: number;
  averageVolume?: number;
  companyName?: string;
  currency?: string;
  cik?: string;
  isin?: string;
  cusip?: string;
  exchangeFullName?: string;
  exchange?: string;
  industry?: string;
  website?: string;
  description?: string;
  ceo?: string;
  sector?: string;
  country?: string;
  fullTimeEmployees?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  image?: string;
  ipoDate?: string;
  isEtf?: boolean;
  isActivelyTrading?: boolean;
  isAdr?: boolean;
  isFund?: boolean;
};

export type TickerProfileRow = {
  ticker: string;
  company_name: string | null;
  description: string | null;
  website: string | null;
  ceo: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  zip: string | null;
  address: string | null;
  phone: string | null;
  full_time_employees: number | null;
  ipo_date: string | null;
  source: string;
};

export type TickerClassificationRow = {
  ticker: string;
  sector: string | null;
  industry: string | null;
  exchange: string | null;
  exchange_full_name: string | null;
  currency: string | null;
  cik: string | null;
  is_etf: boolean | null;
  is_fund: boolean | null;
  is_adr: boolean | null;
  is_actively_trading: boolean | null;
  source: string;
};

export type TickerMarketDataRow = {
  ticker: string;
  price: number | null;
  market_cap: number | null;
  beta: number | null;
  last_dividend: number | null;
  fifty_two_week_range: string | null;
  price_change: number | null;
  price_change_percentage: number | null;
  volume: number | null;
  average_volume: number | null;
};

export type TickerTagRow = {
  tag: string;
  source_rule: string | null;
};
