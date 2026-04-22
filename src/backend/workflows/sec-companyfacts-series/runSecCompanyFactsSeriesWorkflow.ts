import { buildCompanyFactsSeriesForCik } from "@/backend/services/sec/companyFacts/series/buildCompanyFactsSeriesForCik";

export async function runSecCompanyFactsSeriesWorkflow(input: {
  tickerCikMap: Record<string, string | null>;
}) {
  const entries = Object.entries(input.tickerCikMap);

  process.stdout.write(`[series] start total=${entries.length}\n`);

  let processed = 0;

  for (const [ticker, cik] of entries) {
    if (!cik) {
      continue;
    }

    processed += 1;

    const startTime = Date.now();

    process.stdout.write(
      `\r[series] (${processed}/${entries.length}) processing ${ticker}`,
    );

    try {
      await buildCompanyFactsSeriesForCik({
        ticker,
        cik,
      });

      const elapsedMs = Date.now() - startTime;

      process.stdout.write(
        `\r[series] (${processed}/${entries.length}) done ${ticker} in ${elapsedMs}ms`,
      );
    } catch (err) {
      process.stdout.write("\n");
      console.error(`[series] failed for ticker=${ticker}, cik=${cik}`, err);
    }
  }

  process.stdout.write("\n[series] done all\n");
}
