export const DEFAULT_FILINGS_LOOKBACK_DAYS = 20;

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

	"4.01": "Changes in Registrant's Certifying Accountant",
	"4.02": "Non-Reliance on Previously Issued Financial Statements",

  "5.01": "Changes in Control of Registrant",
  "5.02": "Departure or Appointment of Directors or Officers",
  "5.03": "Amendments to Articles of Incorporation or Bylaws",
  "5.05": "Amendments to Code of Ethics",
	"5.04": "Temporary Suspension of Trading Under Employee Benefit Plans",
	"5.06": "Change in Shell Company Status",
	"5.07": "Submission of Matters to a Vote of Security Holders",
	"5.08": "Shareholder Director Nominations",

	"6.01": "ABS Informational and Computational Material",
	"6.02": "Change of Servicer or Trustee",
	"6.03": "Change in Credit Enhancement or External Support",
	"6.04": "Failure to Make Required Distribution",
	"6.05": "Securities Act Updating Disclosure",
	"6.06": "Static Pool",
	"6.10": "Alternative Filings of Asset-Backed Issuers",

  "7.01": "Regulation FD Disclosure",

	"8.01": "Other Events",
	"8.01.1": "Dividend Declaration / Shareholder Distribution", // 내부 확장용 별칭

  "9.01": "Financial Statements and Exhibits",
};

export const FILING_EXHIBIT_LABELS: Record<string, string> = {
	"1.1": "Underwriting Agreement",
	"2.1": "Acquisition Agreement / Merger Agreement",
  "3.1": "Articles of Incorporation",
  "3.2": "Bylaws",
	"4.1": "Indenture or Security Instrument",
	"4.2": "Description of Securities",

  "10.1": "Material Contract",
  "10.2": "Executive Compensation Agreement",
	"10.3": "Employment Agreement",
	"10.4": "Bonus / Incentive Plan",
	"10.5": "Severance Agreement",

  "21.1": "Subsidiaries List",
	"23.1": "Consent of Independent Registered Public Accounting Firm",

	"31.1": "CEO Certification (Section 302)",
	"31.2": "CFO Certification (Section 302)",

	"32.1": "CEO Certification (Section 906)",
	"32.2": "CFO Certification (Section 906)",

  "99.1": "Press Release",
  "99.2": "Supplemental Information",
  "99.3": "Investor Presentation",
	"99.4": "Supplemental Press Material",
	"99.5": "Earnings Presentation",

	"101": "Interactive Data Files",
	"101.INS": "XBRL Instance Document",
	"101.SCH": "XBRL Taxonomy Extension Schema",
	"101.CAL": "XBRL Taxonomy Extension Calculation Linkbase",
	"101.DEF": "XBRL Taxonomy Extension Definition Linkbase",
	"101.LAB": "XBRL Taxonomy Extension Label Linkbase",
	"101.PRE": "XBRL Taxonomy Extension Presentation Linkbase",

	"104": "Cover Page Interactive Data (Inline XBRL)",
};
