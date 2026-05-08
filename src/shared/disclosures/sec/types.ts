// shared/disclosures/sec/types.ts
import type { FilingForm } from "@/shared/disclosures/sec/constants";

export type RecentSecDisclosuresRequest = {
  tickers: string[];
  days?: number;
  forms?: FilingForm[];
};

export type RecentSecDisclosureItem = {
  ticker: string;
  companyName: string | null;
  cik: string | null;
  form: FilingForm;
  filingDate: string;
  accessionNumber: string;
  primaryDocument: string | null;
  secUrl: string | null;

  // (optional)
  filingItems?: SecDisclosureFilingItemEntry[];
  exhibits?: SecDisclosureExhibitEntry[];
};

export type RecentSecDisclosuresResponse = {
  items: RecentSecDisclosureItem[];
};

export type SecDisclosureFilingItemEntry = {
  itemCode: string;
  itemTitle: string | null;
  signal?: {
    type: string;
    data: unknown;
  } | null;
};

export type SecDisclosureExhibitEntry = {
  exhibitNo: string;
  description: string | null;
};
