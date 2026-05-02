export type TickerIdentityRow = {
  ticker: string;
  cik: string | null;
  companyName: string | null;
  exchange: string | null;
  exchangeFullName: string | null;
  source: string;
};

export type TickerCompanyProfileRow = {
  ticker: string;
  description: string | null;
  website: string | null;
  ceo: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  zip: string | null;
  address: string | null;
  phone: string | null;
  fullTimeEmployees: number | null;
  ipoDate: string | null;
  source: string;
};

export type TickerCompanyClassificationRow = {
  ticker: string;
  sector: string | null;
  industry: string | null;
  currency: string | null;
  cusip: string | null;
  isin: string | null;
  isEtf: boolean | null;
  isFund: boolean | null;
  isAdr: boolean | null;
  isActivelyTrading: boolean | null;
  source: string;
};

export type TickerMarketSnapshotRow = {
  ticker: string;
  price: number | null;
  marketCap: number | null;
  beta: number | null;
  lastDividend: number | null;
  fiftyTwoWeekRange: string | null;
  priceChange: number | null;
  priceChangePercentage: number | null;
  volume: number | null;
  averageVolume: number | null;
  source: string;
};

export type TickerCoreRows = {
  identity: TickerIdentityRow;
  profile: TickerCompanyProfileRow;
  classification: TickerCompanyClassificationRow;
  marketSnapshot: TickerMarketSnapshotRow;
};
