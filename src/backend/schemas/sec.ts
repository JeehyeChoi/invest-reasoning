// backend/schemas/sec.ts

/**
 * =========================
 * Common
 * =========================
 */

export type CIK = string;

export type SecFormType = string;

/**
 * =========================
 * Company submissions
 * - /submissions/CIK##########.json
 * - company 1개 기준 recent filings
 * =========================
 */

export type SecSubmissionsRecent = {
  accessionNumber?: string[];
  filingDate?: string[];
  acceptanceDateTime?: string[];
  form?: string[];
  primaryDocument?: string[];
  primaryDocDescription?: string[];
  reportDate?: string[];
};

export type SecSubmissionsFilings = {
  recent?: SecSubmissionsRecent;
};

export type SecSubmissionsResponse = {
  cik: string;
  entityType?: string;
  sic?: string;
  sicDescription?: string;
  name?: string;
  tickers?: string[];
  exchanges?: string[];
  filings?: SecSubmissionsFilings;
};

/**
 * =========================
 * Recent filings feed (internal normalized raw shape)
 * - source가 submissions든, latest filings든, rss든
 *   공통으로 맞춰 담을 내부 raw item
 * =========================
 */

export type SecRecentFeedItemRaw = {
  cik: string | null;
  ticker: string | null;
  companyName: string | null;
  form: string;
  filingDate: string;
  accessionNumber: string;
  primaryDocument: string | null;
  secUrl: string | null;
};

/**
 * =========================
 * Company Facts
 * =========================
 */

export type SecCompanyFactsUnitItem = {
  val: number;
  accn?: string;
  fy?: number;
  fp?: string;
  form?: string;
  filed?: string;
  frame?: string;
};

export type SecCompanyFactsUnits = {
  [unit: string]: SecCompanyFactsUnitItem[];
};

export type SecCompanyFactsConcept = {
  label?: string;
  description?: string;
  units?: SecCompanyFactsUnits;
};

export type SecCompanyFactsTaxonomy = {
  [conceptName: string]: SecCompanyFactsConcept;
};

export type SecCompanyFactsResponse = {
  cik: string;
  entityName?: string;
  facts?: {
    [taxonomy: string]: SecCompanyFactsTaxonomy;
  };
};

/**
 * =========================
 * Company Concept
 * =========================
 */

export type SecCompanyConceptResponse = {
  cik: string;
  taxonomy: string;
  tag: string;
  label?: string;
  description?: string;
  units?: SecCompanyFactsUnits;
};

/**
 * =========================
 * Derived / Internal (optional helpers)
 * =========================
 */

// filings를 flatten해서 쓸 때 내부적으로 쓸 raw item
export type SecRecentFilingRawItem = {
  accessionNumber: string;
  filingDate: string;
  form: string;
  primaryDocument: string | null;
};
