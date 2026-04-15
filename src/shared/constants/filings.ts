export const DEFAULT_FILINGS_LOOKBACK_DAYS = 14;

export const DEFAULT_FILING_FORMS = ["10-Q", "10-K", "8-K"] as const;
export type FilingForm = (typeof DEFAULT_FILING_FORMS)[number];
export const FILING_FORM_LABELS: Record<FilingForm, string> = {
  "10-Q": "Quarterly Report",
  "10-K": "Annual Report",
  "8-K": "Current Report (Material Event)",
};

// 8-K Item descriptions
export const FILING_ITEM_LABELS: Record<string, string> = {
  "1.01": "Entry into a Material Definitive Agreement",
  "1.02": "Termination of a Material Definitive Agreement",
  "1.03": "Bankruptcy or Receivership",

  "2.01": "Completion of Acquisition or Disposition of Assets",
  "2.02": "Results of Operations and Financial Condition",
  "2.03": "Creation of a Direct Financial Obligation",
  "2.04": "Triggering Events That Accelerate Obligations",
  "2.05": "Costs Associated with Exit or Disposal Activities",
  "2.06": "Material Impairments",

  "3.01": "Notice of Delisting or Failure to Satisfy Listing Rule",
  "3.02": "Unregistered Sales of Equity Securities",
  "3.03": "Material Modification to Rights of Security Holders",

  "5.01": "Changes in Control of Registrant",
  "5.02": "Departure or Appointment of Directors or Officers",
  "5.03": "Amendments to Articles of Incorporation or Bylaws",
  "5.05": "Amendments to Code of Ethics",

  "7.01": "Regulation FD Disclosure",

  "8.01": "Other Events",

  "9.01": "Financial Statements and Exhibits",
};

export const FILING_EXHIBIT_LABELS: Record<string, string> = {
  "99.1": "Press Release",
  "99.2": "Supplemental Information",
  "99.3": "Investor Presentation",

  "104": "Cover Page Interactive Data (Inline XBRL)",

  "10.1": "Material Contract",
  "10.2": "Executive Compensation Agreement",

  "3.1": "Articles of Incorporation",
  "3.2": "Bylaws",

  "21.1": "Subsidiaries List",
};
