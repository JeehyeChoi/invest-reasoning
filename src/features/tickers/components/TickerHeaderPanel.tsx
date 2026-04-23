import type { TickerOverviewCompany } from "@/backend/schemas/tickers/tickerOverview";
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

export function TickerHeaderPanel({
  ticker,
  company,
}: {
  ticker: string;
  company: TickerOverviewCompany | null;
}) {
  return (
    <Panel title="Company Profile">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Ticker" value={ticker} />
        <Field label="Company" value={company?.companyName ?? "-"} />
        <Field label="Sector" value={company?.sector ?? "-"} />
        <Field label="Industry" value={company?.industry ?? "-"} />
        <Field
          label="Market Cap"
          value={formatMarketCap(company?.marketCap ?? null)}
        />
        <Field label="CEO" value={company?.ceo ?? "-"} />
        <Field label="IPO Date" value={formatDate(company?.ipoDate)} />
        <Field
          label="Employees"
          value={formatInteger(company?.fullTimeEmployees)}
        />
        <Field label="Headquarters" value={formatHeadquarters(company)} />
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
