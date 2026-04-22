// backend/services/filings/findWatchlistRecentFilings.ts

import { fetchSecSubmissions } from "@/backend/clients/sec";
import { fetchSecDocument } from "@/backend/clients/secDocument";
import { normalizeCikForArchivePath } from "@/backend/utils/sec";
import { DEFAULT_FILING_FORMS, DEFAULT_FILINGS_LOOKBACK_DAYS, type FilingForm } from "@/shared/constants/filings";
import type { SecSubmissionsResponse } from "@/backend/schemas/sec";
import type {
  FilingExhibitEntry,
  FilingItemEntry,
  RecentFilingItem,
} from "@/features/filings/schemas/recentFilings";
import { getTickerProfilesByTickers } from "@/backend/services/metadata/tickerReadRepository";
import { parseFilingItems } from "@/backend/services/filings/parseFilingItems";
import { parseFilingExhibits } from "@/backend/services/filings/parseFilingExhibits";
import { parseItem801Signals } from "@/backend/services/filings/parseItem801Signals";

import { normalizeTickers } from "@/shared/utils/tickers";

function isAllowedForm(form: string, forms: FilingForm[]): form is FilingForm {
  return forms.includes(form as FilingForm);
}

function isWithinDays(filingDate: string, days: number): boolean {
  const filedAt = new Date(filingDate);

  if (Number.isNaN(filedAt.getTime())) {
    return false;
  }

  const now = new Date();
  const diffMs = now.getTime() - filedAt.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  return diffDays >= 0 && diffDays <= days;
}

function normalizeForms(forms?: FilingForm[]): FilingForm[] {
  if (!forms || forms.length === 0) {
    return [...DEFAULT_FILING_FORMS];
  }

  return Array.from(new Set(forms));
}

function buildSecFilingUrl(
  cik: string,
  accessionNumber: string,
  primaryDocument?: string | null
): string | null {
  const normalizedCik = normalizeCikForArchivePath(cik);
  const accessionNoDashes = accessionNumber.replace(/-/g, "");

  if (!normalizedCik || !accessionNoDashes) {
    return null;
  }

  if (!primaryDocument) {
    return `https://www.sec.gov/Archives/edgar/data/${normalizedCik}/${accessionNoDashes}/`;
  }

  return `https://www.sec.gov/Archives/edgar/data/${normalizedCik}/${accessionNoDashes}/${primaryDocument}`;
}

async function mapRecentSubmissionItems(params: {
  ticker: string;
  companyName: string | null;
  cik: string;
  submissions: SecSubmissionsResponse;
  forms: FilingForm[];
  days: number;
}): Promise<RecentFilingItem[]> {
  const { ticker, companyName, cik, submissions, forms, days } = params;

  const recent = submissions.filings?.recent;

  if (!recent) {
    return [];
  }

  const accessionNumbers = recent.accessionNumber ?? [];
  const filingDates = recent.filingDate ?? [];
  const formValues = recent.form ?? [];
  const primaryDocuments = recent.primaryDocument ?? [];

  const maxLength = Math.max(
    accessionNumbers.length,
    filingDates.length,
    formValues.length,
    primaryDocuments.length
  );

  const items: RecentFilingItem[] = [];

	for (let i = 0; i < maxLength; i += 1) {
		const accessionNumber = accessionNumbers[i];
		const filingDate = filingDates[i];
		const form = formValues[i];
		const primaryDocument = primaryDocuments[i] ?? null;

		if (!accessionNumber || !filingDate || !form) {
			continue;
		}

		if (!isAllowedForm(form, forms)) {
			continue;
		}

		if (!isWithinDays(filingDate, days)) {
			continue;
		}

		const secUrl = buildSecFilingUrl(cik, accessionNumber, primaryDocument);

		let filingItems: RecentFilingItem["filingItems"] = [];
		let exhibits: RecentFilingItem["exhibits"] = [];

		if (form === "8-K" && secUrl) {
			const rawDocument = await fetchSecDocument(secUrl);

			if (rawDocument) {
				const parsedItems = parseFilingItems(rawDocument);

				filingItems = parsedItems.map((item) => ({
					itemCode: item.itemCode,
					itemTitle: item.itemTitle,
					signal:
						item.itemCode === "8.01"
							? parseItem801Signals(item.body)
							: null,
				}));

				exhibits = parseFilingExhibits(rawDocument, secUrl);
			}
		}

		items.push({
			ticker,
			companyName: companyName ?? submissions.name ?? null,
			cik,
			form,
			filingDate,
			accessionNumber,
			primaryDocument,
			secUrl,
			filingItems,
			exhibits,
		});
	}

  return items;
}

type FindWatchlistRecentFilingsInput = {
  tickers: string[];
  days?: number;
  forms?: FilingForm[];
};

type FindWatchlistRecentFilingsResult = {
  items: RecentFilingItem[];
  warnings: string[];
};

export async function findWatchlistRecentFilings({
  tickers,
  days = DEFAULT_FILINGS_LOOKBACK_DAYS,
  forms = [...DEFAULT_FILING_FORMS],
}: FindWatchlistRecentFilingsInput): Promise<FindWatchlistRecentFilingsResult> {
  const normalizedTickers = normalizeTickers(tickers);
  const normalizedForms = normalizeForms(forms);

  if (normalizedTickers.length === 0) {
    return { items: [], warnings: [] };
  }

  const profiles = await getTickerProfilesByTickers(normalizedTickers);

  const profileByTicker = new Map(
    profiles.map((profile) => [profile.ticker, profile] as const)
  );

  const warnings: string[] = [];
  const allItems: RecentFilingItem[] = [];

  for (const ticker of normalizedTickers) {
    const profile = profileByTicker.get(ticker);

    if (!profile) {
      warnings.push(`${ticker}: no saved profile found in database`);
      continue;
    }

    const cik = profile.cik?.trim() ?? null;

    if (!cik) {
      warnings.push(`${ticker}: missing CIK in saved profile`);
      continue;
    }

    try {
      const submissions = await fetchSecSubmissions(cik);

      const items = await mapRecentSubmissionItems({
        ticker,
        companyName: profile.companyName ?? submissions.name ?? null,
        cik,
        submissions,
        forms: normalizedForms,
        days,
      });

      if (items.length === 0) {
        warnings.push(`${ticker}: no matching recent filings found`);
      }

      allItems.push(...items);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown filings fetch error";

      console.error(`[findWatchlistRecentFilings] ${ticker}:`, error);
      warnings.push(`${ticker}: ${message}`);
    }
  }

  allItems.sort((a, b) => {
    const dateDiff =
      new Date(b.filingDate).getTime() - new Date(a.filingDate).getTime();

    if (dateDiff !== 0) {
      return dateDiff;
    }

    return a.ticker.localeCompare(b.ticker);
  });

  return {
    items: allItems,
    warnings,
  };
}
