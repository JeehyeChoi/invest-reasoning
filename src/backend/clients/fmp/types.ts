export type FmpTickerProfileRecord = {
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

export type FmpUsMarketHolidayRecord = {
  date?: string;
  exchange?: string;
  name?: string;
  isTrading?: boolean;
};

export type FmpSp500ConstituentRecord = {
  symbol?: string;
  name?: string;
  sector?: string;
  subSector?: string;
  headQuarter?: string;
  dateFirstAdded?: string;
  cik?: string;
  founded?: string;
};
