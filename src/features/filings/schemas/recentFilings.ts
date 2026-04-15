// features/filings/schemas/recentFilings.ts
import type { FilingForm } from "@/shared/constants/filings";

export type RecentFilingsRequest = {
  tickers: string[];
  days?: number;
  forms?: FilingForm[];
};

export type RecentFilingItem = {
  ticker: string;
  companyName: string | null;
  cik: string | null;
  form: FilingForm;
  filingDate: string;
  accessionNumber: string;
  primaryDocument: string | null;
  secUrl: string | null;

  // (optional)
  filingItems?: FilingItemEntry[];
  exhibits?: FilingExhibitEntry[];
};

export type RecentFilingsResponse = {
  items: RecentFilingItem[];
};

export type FilingItemEntry = {
  itemCode: string;
  itemTitle: string | null;
};

export type FilingExhibitEntry = {
  exhibitNo: string;
  description: string | null;
};
