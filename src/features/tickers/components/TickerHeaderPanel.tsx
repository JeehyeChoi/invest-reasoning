import type { TickerOverviewCompany } from "@/shared/tickers/tickerOverview";
import { Field, Panel } from "@/features/tickers/components/TickerDetailPrimitives";
import {
  formatDate,
  formatInteger,
  formatMarketCap,
} from "@/features/tickers/utils/formatters";

function formatHeadquarters(company: TickerOverviewCompany | null): string {
  if (!company) return "-";

  const cityState = [company.city, company.state].filter(Boolean).join(", ");
  const full = [cityState, company.zip].filter(Boolean).join(" ").trim();

  return full || "-";
}

function formatLatestAnnualPeriod(company: TickerOverviewCompany | null): string {
  const profile = company?.fiscalProfile;
  if (!profile?.latestAnnualStart || !profile.latestAnnualEnd) {
    return "-";
  }
  const fy = profile.latestFiscalYear ? `FY${profile.latestFiscalYear} ` : "";
  return `${fy}(${profile.latestAnnualStart} → ${profile.latestAnnualEnd})`;
}

function getInstrumentType(company: TickerOverviewCompany | null): string {
  if (company?.isEtf) return "ETF";
  if (company?.isFund) return "Fund";
  if (company?.isAdr) return "ADR";
  return "Company";
}

function formatPrice(value?: number | null, currency?: string | null): string {
  if (value == null || !Number.isFinite(value)) return "-";
  const prefix = currency === "USD" || !currency ? "$" : `${currency} `;
  return `${prefix}${value.toFixed(2)}`;
}

function formatChange(value?: number | null, percentage?: number | null): string {
  const parts = [
    value == null || !Number.isFinite(value) ? null : value.toFixed(2),
    percentage == null || !Number.isFinite(percentage)
      ? null
      : `${percentage.toFixed(2)}%`,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" / ") : "-";
}

export function TickerHeaderPanel({
  ticker,
  company,
}: {
  ticker: string;
  company: TickerOverviewCompany | null;
}) {
  const isFundLike = Boolean(company?.isEtf || company?.isFund);

  return (
    <Panel title={isFundLike ? "Fund Profile" : "Company Profile"}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Ticker" value={ticker} />
        <Field label={isFundLike ? "Fund" : "Company"} value={company?.companyName ?? "-"} />
        <Field label="Instrument" value={getInstrumentType(company)} />
        <Field label="Exchange" value={company?.exchangeFullName ?? company?.exchange ?? "-"} />
        <Field label="Currency" value={company?.currency ?? "-"} />
        <Field label={isFundLike ? "Category" : "Sector"} value={company?.sector ?? "-"} />
        <Field label={isFundLike ? "Focus" : "Industry"} value={company?.industry ?? "-"} />
        <Field label="Price" value={formatPrice(company?.price, company?.currency)} />
        <Field label="Change" value={formatChange(company?.priceChange, company?.priceChangePercentage)} />
        <Field
          label="Market Cap"
          value={formatMarketCap(company?.marketCap ?? null)}
        />
        <Field label="Volume" value={formatInteger(company?.volume)} />
        <Field label="Average Volume" value={formatInteger(company?.averageVolume)} />
        <Field label="52 Week Range" value={company?.fiftyTwoWeekRange ?? "-"} />
        <Field label="Actively Trading" value={company?.isActivelyTrading === null || company?.isActivelyTrading === undefined ? "-" : company.isActivelyTrading ? "Yes" : "No"} />
        {!isFundLike ? (
          <>
            <Field label="Latest Annual Period" value={formatLatestAnnualPeriod(company)} />
            <Field label="CEO" value={company?.ceo ?? "-"} />
            <Field label="IPO Date" value={formatDate(company?.ipoDate)} />
            <Field
              label="Employees"
              value={formatInteger(company?.fullTimeEmployees)}
            />
            <Field label="Headquarters" value={formatHeadquarters(company)} />
          </>
        ) : null}
				<Field
					label="Website"
					value={
						company?.website ? (
							<a
								href={company.website}
								target="_blank"
								rel="noreferrer"
								className="underline"
							>
								{company.website}
							</a>
						) : (
							"-"
						)
					}
				/>
      </div>

			{company?.description ? (
				<div className="mt-4">
					<div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
						Description
					</div>

          <div className="mt-1 max-h-40 overflow-y-auto border border-black bg-white p-2 text-sm leading-relaxed text-muted-foreground">
						{company.description}
					</div>
				</div>
			) : null}
    </Panel>
  );
}
