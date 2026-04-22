import type { TickerOverviewCompany } from "@/backend/schemas/tickers/tickerOverview";
import { Field, Panel } from "@/features/tickers/components/TickerDetailPrimitives";
import { formatMarketCap } from "@/features/tickers/utils/formatters";

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
      </div>
    </Panel>
  );
}
