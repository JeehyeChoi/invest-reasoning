-- Discover factor tag candidates from currently ingested SEC company-facts raw data.
--
-- This script is for research only. It does not mutate data.
-- It intentionally excludes tags already captured by sec_companyfact_tag_series
-- so the output focuses on unmapped candidate tags.

-- 1. Discovery scope.
SELECT
  (SELECT count(DISTINCT cik) FROM public.sec_companyfact_raw) AS raw_ciks,
  (SELECT count(*) FROM public.ticker_identities WHERE cik IS NOT NULL) AS mapped_tickers,
  (
    SELECT count(*)
    FROM public.ticker_company_classifications
    WHERE sector IS NOT NULL
  ) AS classified_tickers,
  (
    SELECT count(DISTINCT r.cik)
    FROM public.sec_companyfact_raw r
    JOIN public.ticker_identities ti ON ti.cik = r.cik
    JOIN public.ticker_company_classifications c ON c.ticker = ti.ticker
    WHERE c.sector IS NOT NULL
  ) AS classified_raw_ciks;

-- 2. Broad factor keyword candidates.
WITH factor_keywords(factor_key, keyword_pattern) AS (
  VALUES
    ('energy_linked', '%Oil%'),
    ('energy_linked', '%Gas%'),
    ('energy_linked', '%Explor%'),
    ('energy_linked', '%Production%'),
    ('commodity_linked', '%Commodity%'),
    ('commodity_linked', '%Copper%'),
    ('commodity_linked', '%Gold%'),
    ('commodity_linked', '%Silver%'),
    ('commodity_linked', '%Metal%'),
    ('consumer_linked', '%Restaurant%'),
    ('consumer_linked', '%Franchise%'),
    ('consumer_linked', '%Casino%'),
    ('consumer_linked', '%CustomerLoyalty%'),
    ('consumer_linked', '%HomeBuilding%'),
    ('consumer_linked', '%Travel%'),
    ('liquidity_sensitive', '%Inventory%'),
    ('liquidity_sensitive', '%Receivable%'),
    ('liquidity_sensitive', '%Payable%'),
    ('rate_sensitive', '%Interest%'),
    ('rate_sensitive', '%Debt%'),
    ('inflation_hedge', '%Hedg%'),
    ('inflation_hedge', '%Derivative%')
),
matched AS (
  SELECT
    fk.factor_key,
    r.tag,
    count(*) AS row_count,
    count(DISTINCT r.cik) AS cik_count,
    count(DISTINCT ti.ticker) AS ticker_count,
    count(DISTINCT c.sector) AS sector_count
  FROM public.sec_companyfact_raw r
  JOIN factor_keywords fk ON r.tag ILIKE fk.keyword_pattern
  JOIN public.ticker_identities ti ON ti.cik = r.cik
  JOIN public.ticker_company_classifications c ON c.ticker = ti.ticker
  LEFT JOIN public.sec_companyfact_tag_series ts
    ON ts.cik = r.cik
   AND ts.tag = r.tag
  WHERE r.taxonomy = 'us-gaap'
    AND r.end >= DATE '2018-01-01'
    AND r.end <= CURRENT_DATE
    AND ts.tag IS NULL
  GROUP BY fk.factor_key, r.tag
),
ranked AS (
  SELECT
    *,
    row_number() OVER (
      PARTITION BY factor_key
      ORDER BY ticker_count DESC, cik_count DESC, row_count DESC, tag
    ) AS rn
  FROM matched
  WHERE ticker_count >= 2
)
SELECT
  factor_key,
  tag,
  ticker_count,
  cik_count,
  sector_count,
  row_count
FROM ranked
WHERE rn <= 25
ORDER BY factor_key, rn;

-- 3. Sector-specific keyword candidates.
WITH tag_sector_counts AS (
  SELECT
    c.sector,
    r.tag,
    count(*) AS row_count,
    count(DISTINCT r.cik) AS cik_count,
    count(DISTINCT ti.ticker) AS ticker_count
  FROM public.sec_companyfact_raw r
  JOIN public.ticker_identities ti ON ti.cik = r.cik
  JOIN public.ticker_company_classifications c ON c.ticker = ti.ticker
  LEFT JOIN public.sec_companyfact_tag_series ts
    ON ts.cik = r.cik
   AND ts.tag = r.tag
  WHERE r.taxonomy = 'us-gaap'
    AND r.end >= DATE '2018-01-01'
    AND r.end <= CURRENT_DATE
    AND ts.tag IS NULL
    AND (
      r.tag ILIKE '%Oil%'
      OR r.tag ILIKE '%Gas%'
      OR r.tag ILIKE '%Explor%'
      OR r.tag ILIKE '%Production%'
      OR r.tag ILIKE '%Film%'
      OR r.tag ILIKE '%Program%'
      OR r.tag ILIKE '%Restaurant%'
      OR r.tag ILIKE '%Franchise%'
      OR r.tag ILIKE '%HomeBuilding%'
      OR r.tag ILIKE '%Casino%'
      OR r.tag ILIKE '%Utility%'
      OR r.tag ILIKE '%Regulated%'
    )
  GROUP BY c.sector, r.tag
),
ranked AS (
  SELECT
    *,
    row_number() OVER (
      PARTITION BY sector
      ORDER BY ticker_count DESC, cik_count DESC, row_count DESC, tag
    ) AS rn
  FROM tag_sector_counts
  WHERE ticker_count >= 2
)
SELECT
  sector,
  tag,
  ticker_count,
  cik_count,
  row_count
FROM ranked
WHERE rn <= 25
ORDER BY sector, rn;

-- 4. Industry-specific keyword candidates.
WITH tag_industry_counts AS (
  SELECT
    c.sector,
    c.industry,
    r.tag,
    count(*) AS row_count,
    count(DISTINCT r.cik) AS cik_count,
    count(DISTINCT ti.ticker) AS ticker_count
  FROM public.sec_companyfact_raw r
  JOIN public.ticker_identities ti ON ti.cik = r.cik
  JOIN public.ticker_company_classifications c ON c.ticker = ti.ticker
  LEFT JOIN public.sec_companyfact_tag_series ts
    ON ts.cik = r.cik
   AND ts.tag = r.tag
  WHERE r.taxonomy = 'us-gaap'
    AND r.end >= DATE '2018-01-01'
    AND r.end <= CURRENT_DATE
    AND ts.tag IS NULL
    AND c.industry IS NOT NULL
    AND (
      r.tag ILIKE '%Oil%'
      OR r.tag ILIKE '%Gas%'
      OR r.tag ILIKE '%Explor%'
      OR r.tag ILIKE '%Production%'
      OR r.tag ILIKE '%Film%'
      OR r.tag ILIKE '%Program%'
      OR r.tag ILIKE '%Restaurant%'
      OR r.tag ILIKE '%Franchise%'
      OR r.tag ILIKE '%HomeBuilding%'
      OR r.tag ILIKE '%Casino%'
      OR r.tag ILIKE '%Utility%'
      OR r.tag ILIKE '%Regulated%'
    )
  GROUP BY c.sector, c.industry, r.tag
),
ranked AS (
  SELECT
    *,
    row_number() OVER (
      PARTITION BY sector, industry
      ORDER BY ticker_count DESC, cik_count DESC, row_count DESC, tag
    ) AS rn
  FROM tag_industry_counts
  WHERE ticker_count >= 2
)
SELECT
  sector,
  industry,
  tag,
  ticker_count,
  cik_count,
  row_count
FROM ranked
WHERE rn <= 25
ORDER BY sector, industry, rn;
