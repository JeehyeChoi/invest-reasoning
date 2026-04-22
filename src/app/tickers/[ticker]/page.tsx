// app/tickers/[ticker]/page.tsx
import { TickerDetailPage } from "@/features/tickers/components/TickerDetailPage";

type PageProps = {
  params: Promise<{ ticker: string }>;
};

export default async function Page({ params }: PageProps) {
  const { ticker } = await params;
  return <TickerDetailPage ticker={ticker} />;
}
