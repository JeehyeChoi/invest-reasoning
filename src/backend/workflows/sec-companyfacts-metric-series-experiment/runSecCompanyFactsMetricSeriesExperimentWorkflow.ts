import { db } from "@/backend/config/db";
import { runSecBulkIngestWorkflow } from "@/backend/workflows/sec-bulk-ingest/runSecBulkIngestWorkflow";
import {
  COMPANY_FACTS_SERIES_TAG_META_EXPERMENT,
  TAG_META_EXPERMENT_WORKFLOW_TYPE,
} from "@/backend/services/sec/companyFacts/series/tagMetaExperment";
import type { DataPipelineRefreshJobKey } from "@/shared/data-pipeline/jobs";

type WorkflowProgress = {
  job?: DataPipelineRefreshJobKey;
  message: string;
  level?: "info" | "warning" | "error";
  current?: number;
  total?: number;
  label?: string;
};

type CandidateTargetRow = {
  cik: string;
  ticker: string | null;
  tags: string[];
  candidate_count: number;
  total_row_count: number;
  eligible_cik_count: number;
};

type EnabledExperimentTag = {
  tag: string;
  metricKey: string;
};

export async function runSecCompanyFactsMetricSeriesExperimentWorkflow(input: {
  tickerCikMap: Record<string, string | null>;
  maxCiks?: number;
  clearBeforeRun?: boolean;
  onProgress?: (progress: WorkflowProgress) => void;
}) {
  const maxCiks = Math.min(Math.max(input.maxCiks ?? 50, 1), 500);
  const enabledTags = Object.entries(COMPANY_FACTS_SERIES_TAG_META_EXPERMENT)
    .filter(([, meta]) => meta.enabled)
    .map(([tag, meta]) => ({
      tag,
      metricKey: meta.metricKey,
    }));

  input.onProgress?.({
    job: "sec_metric_series_experiment",
    message: `SEC metric series experiment target selection started. workflow=${TAG_META_EXPERMENT_WORKFLOW_TYPE}, enabledTags=${enabledTags.length}.`,
  });

  if (enabledTags.length === 0) {
    input.onProgress?.({
      job: "sec_metric_series_experiment",
      message: "SEC metric series experiment skipped. No enabled tags in tagMetaExperment.",
    });
    return { targetCikCount: 0, processedCount: 0 };
  }

  if (input.clearBeforeRun) {
    await db.query("TRUNCATE TABLE public.sec_companyfact_metric_series_experiment");
    input.onProgress?.({
      job: "sec_metric_series_experiment",
      message: "SEC metric series experiment table truncated before run.",
    });
  }

  const tickerByCik = buildTickerByCik(input.tickerCikMap);
  const allowedCiks = [...tickerByCik.keys()];
  const targets = await loadCandidateExperimentTargets({
    allowedCiks,
    tags: enabledTags,
    maxCiks,
  });
  const targetCiks = new Set(targets.map((target) => target.cik));
  const experimentTagsByCik = buildExperimentTagsByCik(targets);

  input.onProgress?.({
    job: "sec_metric_series_experiment",
    message: `SEC metric series experiment targets resolved from candidate stats. targetCiks=${targetCiks.size}, eligibleCiks=${targets[0]?.eligible_cik_count ?? 0}, maxCiks=${maxCiks}, sample=random.`,
    current: 0,
    total: targetCiks.size,
  });

  if (targetCiks.size === 0) {
    return { targetCikCount: 0, processedCount: 0 };
  }

  const result = await runSecBulkIngestWorkflow({
    allowedCiks: targetCiks,
    forceReadAll: true,
    tickerByCik,
    buildMetricSeriesExperimentBeforeTagCleanup: true,
    experimentTagsByCik,
    cleanupTagSeriesAfterMetric: true,
    onProgress: (progress) =>
      input.onProgress?.({
        ...progress,
        job: "sec_metric_series_experiment",
      }),
  });

  input.onProgress?.({
    job: "sec_metric_series_experiment",
    message: `SEC metric series experiment completed. targetCiks=${targetCiks.size}, processed=${result.processedCount}, failed=${result.failedCount}.`,
    current: targetCiks.size,
    total: targetCiks.size,
  });

  return {
    targetCikCount: targetCiks.size,
    processedCount: result.processedCount,
  };
}

async function loadCandidateExperimentTargets(input: {
  allowedCiks: string[];
  tags: EnabledExperimentTag[];
  maxCiks: number;
}): Promise<CandidateTargetRow[]> {
  if (input.allowedCiks.length === 0 || input.tags.length === 0) {
    return [];
  }

  const result = await db.query<CandidateTargetRow>(
    `
    WITH enabled_tags(tag, metric_key) AS (
      SELECT *
      FROM unnest($2::text[], $3::text[]) AS enabled(tag, metric_key)
    ),
    missing_metric_candidates AS (
      SELECT
        s.cik,
        s.ticker,
        s.tag,
        s.row_count
      FROM public.sec_companyfact_tag_candidate_stats s
      JOIN enabled_tags e ON e.tag = s.tag
      WHERE s.cik = ANY($1::text[])
        AND s.taxonomy = 'us-gaap'
        AND s.fact_type_guess = 'instant'
        AND NOT EXISTS (
          SELECT 1
          FROM public.sec_companyfact_metric_series m
          WHERE m.cik = s.cik
            AND m.metric_key = e.metric_key
        )
    ),
    grouped_candidates AS (
      SELECT
        cik,
        MAX(ticker) AS ticker,
        ARRAY_AGG(DISTINCT tag ORDER BY tag) AS tags,
        COUNT(DISTINCT tag) AS candidate_count,
        SUM(row_count) AS total_row_count
      FROM missing_metric_candidates
      GROUP BY cik
    ),
    eligible_count AS (
      SELECT COUNT(*)::int AS eligible_cik_count
      FROM grouped_candidates
    ),
    sampled_candidates AS (
      SELECT *
      FROM grouped_candidates
      ORDER BY random()
      LIMIT $4
    )
    SELECT
      s.cik,
      s.ticker,
      s.tags,
      s.candidate_count,
      s.total_row_count,
      e.eligible_cik_count
    FROM sampled_candidates s
    CROSS JOIN eligible_count e
    ORDER BY s.cik ASC
    `,
    [
      input.allowedCiks,
      input.tags.map((item) => item.tag),
      input.tags.map((item) => item.metricKey),
      input.maxCiks,
    ],
  );

  return result.rows;
}

function buildExperimentTagsByCik(
  targets: CandidateTargetRow[],
): Map<string, string[]> {
  const result = new Map<string, string[]>();

  for (const target of targets) {
    result.set(target.cik, target.tags);
  }

  return result;
}

function buildTickerByCik(
  tickerCikMap: Record<string, string | null>,
): Map<string, string> {
  const tickerByCik = new Map<string, string>();

  for (const [ticker, cik] of Object.entries(tickerCikMap)) {
    if (cik) {
      tickerByCik.set(cik, ticker);
    }
  }

  return tickerByCik;
}
