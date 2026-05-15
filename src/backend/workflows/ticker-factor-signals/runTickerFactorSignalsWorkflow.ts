import { buildTickerFactorSignals } from "@/backend/services/sec/companyFacts/series/signal/buildTickerFactorSignals";
import { db } from "@/backend/config/db";
import {
  resolveSnapshotDates,
  type SnapshotFrequency,
} from "@/backend/workflows/utils/snapshotDates";
import type { FactorAxisKey } from "@/shared/factors/axes";
import type { FactorKey } from "@/shared/factors/factors";
import { normalizeTickers } from "@/shared/tickers/utils";

export type RunTickerFactorSignalsWorkflowInput = {
  targets?: TickerFactorSignalTarget[];
  asOfDate?: string;
  tickers?: string[];
  changedOnly?: boolean;
  snapshotDates?: string[];
  startDate?: string;
  endDate?: string;
  frequency?: SnapshotFrequency;
  onProgress?: (progress: {
    message: string;
    current?: number;
    total?: number;
    label?: string;
  }) => void;
};

export type TickerFactorSignalTarget = {
  factor: FactorKey;
  axis: FactorAxisKey;
};

export type TickerFactorSignalsWorkflowResult = {
  processed: number;
  tickerCount?: number;
  snapshotDates?: string[];
  completedRuns?: number;
};

async function loadSignalTargetsFromDefinitions(): Promise<
  TickerFactorSignalTarget[]
> {
  const result = await db.query<TickerFactorSignalTarget>(
    `
    SELECT DISTINCT
      factor,
      axis
    FROM public.ticker_factor_signal_definitions
    WHERE model_key = 'factor_signal'
      AND model_version = 'v0'
      AND is_active = true
    ORDER BY factor ASC, axis ASC
    `,
  );

  return dedupeSignalTargets(result.rows);
}

function dedupeSignalTargets(
  targets: TickerFactorSignalTarget[],
): TickerFactorSignalTarget[] {
  const seen = new Set<string>();
  const output: TickerFactorSignalTarget[] = [];

  for (const target of targets) {
    const key = `${target.factor}:${target.axis}`;
    if (seen.has(key)) continue;

    seen.add(key);
    output.push(target);
  }

  return output;
}

export async function runTickerFactorSignalsWorkflow(
  input: RunTickerFactorSignalsWorkflowInput = {},
): Promise<TickerFactorSignalsWorkflowResult> {
  const tickers = await resolveTickerFilter(input);
  if (tickers?.length === 0) {
    input.onProgress?.({
      message: "Factor signals skipped. No source-updated tickers detected.",
      current: 0,
      total: 0,
    });

    return {
      processed: 0,
      tickerCount: 0,
    };
  }

  const snapshotDates = resolveSnapshotDates({
    ...input,
    defaultToTimeline: !input.asOfDate,
  });
  if (snapshotDates.length > 0) {
    let processed = 0;
    const targets = input.targets
      ? dedupeSignalTargets(input.targets)
      : await loadSignalTargetsFromDefinitions();

    for (const [index, target] of targets.entries()) {
      const label = `${target.factor}/${target.axis}`;
      input.onProgress?.({
        message: `Factor signals building ${label} timeline.`,
        current: index + 1,
        total: targets.length,
        label,
      });

      for (const snapshotDate of snapshotDates) {
        await buildTickerFactorSignals({
          factor: target.factor,
          axis: target.axis,
          asOfDate: snapshotDate,
          tickers,
        });

        processed += 1;
      }
    }

    return {
      processed,
      tickerCount: tickers?.length,
      snapshotDates,
      completedRuns: snapshotDates.length,
    };
  }

  const targets = input.targets
    ? dedupeSignalTargets(input.targets)
    : await loadSignalTargetsFromDefinitions();

  for (const [index, target] of targets.entries()) {
    const label = `${target.factor}/${target.axis}`;

    input.onProgress?.({
      message: `Factor signals building ${label}.`,
      current: index + 1,
      total: targets.length,
      label,
    });

    await buildTickerFactorSignals({
      factor: target.factor,
      axis: target.axis,
      asOfDate: input.asOfDate,
      tickers,
    });

    input.onProgress?.({
      message: `Factor signals completed ${label}.`,
      current: index + 1,
      total: targets.length,
      label,
    });
  }

  return {
    processed: targets.length,
    tickerCount: tickers?.length,
  };
}

async function resolveTickerFilter(
  input: RunTickerFactorSignalsWorkflowInput,
): Promise<string[] | undefined> {
  if (input.tickers) {
    return normalizeTickers(input.tickers);
  }

  if (!input.changedOnly) {
    return undefined;
  }

  return loadTickersWithFeatureUpdatesSinceSignals();
}

async function loadTickersWithFeatureUpdatesSinceSignals(): Promise<string[]> {
  const result = await db.query<{ ticker: string }>(
    `
    WITH signal_state AS (
      SELECT
        ticker,
        MAX(updated_at) AS last_signal_updated_at
      FROM public.ticker_factor_signals
      WHERE model_key = 'factor_signal'
        AND model_version = 'v0'
      GROUP BY ticker
    )
    SELECT features.ticker
    FROM (
      SELECT
        ticker,
        MAX(updated_at) AS last_feature_updated_at
      FROM public.ticker_factor_metric_features
      WHERE feature_value IS NOT NULL
      GROUP BY ticker
    ) features
    LEFT JOIN signal_state signals
      ON signals.ticker = features.ticker
    WHERE signals.last_signal_updated_at IS NULL
      OR features.last_feature_updated_at > signals.last_signal_updated_at
    ORDER BY features.ticker
    `,
  );

  return normalizeTickers(result.rows.map((row) => row.ticker));
}

export async function loadTickersWithDailyPriceOrSecUpdatesSinceSignals(): Promise<
  string[]
> {
  const result = await db.query<{ ticker: string }>(
    `
    WITH signal_state AS (
      SELECT
        ticker,
        MAX(updated_at) AS last_signal_updated_at
      FROM public.ticker_factor_signals
      WHERE model_key = 'factor_signal'
        AND model_version = 'v0'
      GROUP BY ticker
    ),
    source_changed AS (
      SELECT DISTINCT price_state.ticker
      FROM public.ticker_daily_price_sync_state price_state
      LEFT JOIN signal_state signals
        ON signals.ticker = price_state.ticker
      WHERE price_state.status IN ('completed', 'partial')
        AND (
          signals.last_signal_updated_at IS NULL
          OR price_state.updated_at > signals.last_signal_updated_at
        )
      UNION
      SELECT DISTINCT identities.ticker
      FROM public.sec_companyfact_company_state company_state
      JOIN public.ticker_identities identities
        ON identities.cik = company_state.cik
      LEFT JOIN signal_state signals
        ON signals.ticker = identities.ticker
      WHERE company_state.last_processed_at IS NOT NULL
        AND (
          signals.last_signal_updated_at IS NULL
          OR company_state.last_processed_at > signals.last_signal_updated_at
        )
    )
    SELECT source_changed.ticker
    FROM source_changed
    ORDER BY ticker
    `,
  );

  return normalizeTickers(result.rows.map((row) => row.ticker));
}
