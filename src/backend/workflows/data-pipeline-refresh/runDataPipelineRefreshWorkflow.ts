import { loadUniverseTickers } from "@/shared/universe/loadUniverseTickers";
import { getTickerCikMap } from "@/backend/services/tickers/getTickerCikMap";

import { runSecBulkIngestWorkflow } from "@/backend/workflows/sec-bulk-ingest/runSecBulkIngestWorkflow";
import { runSecCompanyFactsSeriesWorkflow } from "@/backend/workflows/sec-companyfacts-series/runSecCompanyFactsSeriesWorkflow";
import { runTickerFactorSnapshotsWorkflow } from "@/backend/workflows/ticker-factor-snapshot/runTickerFactorSnapshotsWorkflow";

export async function runDataPipelineRefreshWorkflow() {
  const tickers = await loadUniverseTickers();
  const tickerCikMap = await getTickerCikMap(tickers);

  const allowedCiks = new Set(
    Object.values(tickerCikMap).filter((cik): cik is string => Boolean(cik)),
  );

  await runSecBulkIngestWorkflow({ allowedCiks });
  //await runSecCompanyFactsSeriesWorkflow({ tickerCikMap });
  await runTickerFactorSnapshotsWorkflow({ tickers, tickerCikMap });
}
