import { db } from "@/backend/config/db";
import { COMPANY_FACTS_SERIES_TAG_META } from "@/backend/services/sec/companyFacts/series/tagMeta";

export type UpsertCompanyFactTagCandidateStatsForCikResult = {
  candidateCount: number;
};

export async function upsertCompanyFactTagCandidateStatsForCik(input: {
  ticker: string;
  cik: string;
}): Promise<UpsertCompanyFactTagCandidateStatsForCikResult> {
  const mappedTags = Object.keys(COMPANY_FACTS_SERIES_TAG_META);
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    await ensureCompanyFactTagCandidateStatsTable(client);
    await client.query(
      `DELETE FROM public.sec_companyfact_tag_candidate_stats WHERE cik = $1`,
      [input.cik],
    );

    const result = await client.query(
      `
      INSERT INTO public.sec_companyfact_tag_candidate_stats (
        cik,
        ticker,
        sector,
        industry,
        taxonomy,
        tag,
        unit,
        fact_type_guess,
        row_count,
        first_end,
        last_end,
        latest_filed,
        sample_accn,
        label,
        description,
        updated_at
      )
      SELECT
        r.cik,
        $2::text AS ticker,
        c.sector,
        c.industry,
        r.taxonomy,
        r.tag,
        r.unit,
        CASE
          WHEN r.start IS NULL THEN 'instant'
          ELSE 'flow'
        END AS fact_type_guess,
        count(*)::integer AS row_count,
        min(r."end") AS first_end,
        max(r."end") AS last_end,
        max(r.filed) AS latest_filed,
        (array_agg(r.accn ORDER BY r.filed DESC NULLS LAST, r."end" DESC))[1]
          AS sample_accn,
        (array_agg(r.label ORDER BY r.filed DESC NULLS LAST, r."end" DESC))[1]
          AS label,
        (array_agg(r.description ORDER BY r.filed DESC NULLS LAST, r."end" DESC))[1]
          AS description,
        now() AS updated_at
      FROM public.sec_companyfact_raw r
      LEFT JOIN public.ticker_company_classifications c
        ON c.ticker = $2::text
      WHERE r.cik = $1
        AND r.taxonomy = 'us-gaap'
        AND r.val IS NOT NULL
        AND r."end" IS NOT NULL
        AND r."end" >= DATE '2018-01-01'
        AND r."end" <= CURRENT_DATE
        AND NOT (r.tag = ANY($3::text[]))
      GROUP BY
        r.cik,
        c.sector,
        c.industry,
        r.taxonomy,
        r.tag,
        r.unit,
        CASE
          WHEN r.start IS NULL THEN 'instant'
          ELSE 'flow'
        END
      ON CONFLICT (
        cik,
        taxonomy,
        tag,
        unit,
        fact_type_guess
      )
      DO UPDATE SET
        ticker = EXCLUDED.ticker,
        sector = EXCLUDED.sector,
        industry = EXCLUDED.industry,
        row_count = EXCLUDED.row_count,
        first_end = EXCLUDED.first_end,
        last_end = EXCLUDED.last_end,
        latest_filed = EXCLUDED.latest_filed,
        sample_accn = EXCLUDED.sample_accn,
        label = EXCLUDED.label,
        description = EXCLUDED.description,
        updated_at = now()
      `,
      [input.cik, input.ticker, mappedTags],
    );

    await client.query("COMMIT");

    return {
      candidateCount: result.rowCount ?? 0,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function ensureCompanyFactTagCandidateStatsTable(
  client: Pick<typeof db, "query">,
): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.sec_companyfact_tag_candidate_stats (
      cik             TEXT NOT NULL,
      ticker          TEXT,
      sector          TEXT,
      industry        TEXT,
      taxonomy        TEXT NOT NULL,
      tag             TEXT NOT NULL,
      unit            TEXT NOT NULL,
      fact_type_guess TEXT NOT NULL,
      row_count       INTEGER NOT NULL,
      first_end       DATE,
      last_end        DATE,
      latest_filed    DATE,
      sample_accn     TEXT,
      label           TEXT,
      description     TEXT,
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

      CONSTRAINT sec_companyfact_tag_candidate_stats_pk
        PRIMARY KEY (cik, taxonomy, tag, unit, fact_type_guess)
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_sec_companyfact_tag_candidate_stats_tag
      ON public.sec_companyfact_tag_candidate_stats (tag)
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_sec_companyfact_tag_candidate_stats_sector
      ON public.sec_companyfact_tag_candidate_stats (sector, industry, tag)
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_sec_companyfact_tag_candidate_stats_ticker
      ON public.sec_companyfact_tag_candidate_stats (ticker, tag)
  `);
}
