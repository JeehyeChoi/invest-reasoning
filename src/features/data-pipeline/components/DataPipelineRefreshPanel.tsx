"use client";

import { CornerDownRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  DATA_PIPELINE_REFRESH_JOB_KEYS,
  DATA_PIPELINE_REFRESH_JOB_DESCRIPTIONS,
  DATA_PIPELINE_REFRESH_JOB_LABELS,
  type DataPipelineCompanyScope,
  type DataPipelineRefreshJobKey,
  type DataPipelineRebuildMode,
  type DataPipelineTickerCoreSyncMode,
  type DataPipelineUniverseRefreshMode,
} from "@/shared/data-pipeline/jobs";
import {
  DEFAULT_UNIVERSE_KEYS,
  UNIVERSE_LABELS,
  UNIVERSE_KEYS,
  type UniverseKey,
} from "@/shared/universe/universes";
import {
  SIGNAL_TIMELINE_AXIS_SCOPE_OPTIONS,
  type SignalTimelineAxisScope,
} from "@/shared/market/signalCombinationTimeline";

import type { PipelineStatus } from "@/shared/data-pipeline/status";
import type { SecBulkIngestState } from "@/features/data-pipeline/schemas/secBulkIngestState";
import type { DatabaseSizeReport } from "@/features/data-pipeline/schemas/databaseSizeReport";

import { triggerDataPipelineRefresh } from "@/features/data-pipeline/services/triggerDataPipelineRefresh";
import { fetchPipelineStatus } from "@/features/data-pipeline/services/fetchPipelineStatus";
import { fetchSecBulkIngestState } from "@/features/data-pipeline/services/fetchSecBulkIngestState";
import { fetchDatabaseSizeReport } from "@/features/data-pipeline/services/fetchDatabaseSizeReport";

type ButtonAction =
  | "run"
  | "status"
  | "secBulk"
  | "dbSize"
  | "tagExperiment";
const STATUS_POLL_INTERVAL_OPTIONS = [
  { label: "15s", value: 15_000 },
  { label: "30s", value: 30_000 },
  { label: "60s", value: 60_000 },
] as const;
type TickerDailyPriceTargetMode = "universe" | "specific";
type TickerCoreTargetMode = "universe" | "specific";
type DataPipelineLockGroup =
  | "universe_memberships"
  | "ticker_core"
  | "macro_fred"
  | "daily_price_history"
  | "sec_companyfacts"
  | "derived_metrics"
  | "factor_features"
  | "factor_outputs";

const SEC_COMPANYFACT_JOB_KEYS: DataPipelineRefreshJobKey[] = [
  "sec_bulk_ingest",
  "series_validation",
];

const PREPARED_SERIES_JOB_KEYS: DataPipelineRefreshJobKey[] = [
  "sec_metric_series_enriched",
  "derived_metric_series",
];

const EXPECTATION_JOB_KEYS: DataPipelineRefreshJobKey[] = [
  "ticker_implied_financial_expectations",
];

const UNIVERSE_MEMBERSHIP_JOB_KEYS: DataPipelineRefreshJobKey[] = [
  "universe_memberships_sync",
];

const COMPANY_PROFILE_JOB_KEYS: DataPipelineRefreshJobKey[] = [
  "ticker_core_sync",
];

const FEATURE_JOB_KEYS: DataPipelineRefreshJobKey[] = [
  "fundamentals_based_factor_features",
  "valuation_factor_features",
  "market_price_factor_features",
  "etf_exposure_factor_features",
  "macro_linked_factor_features",
];

const MARKET_DATA_JOB_KEYS: DataPipelineRefreshJobKey[] = [
  "ticker_daily_price_history_sync",
  "macro_fred_series_sync",
];

const SIGNAL_JOB_KEYS: DataPipelineRefreshJobKey[] = [
  "factor_signals",
  "signal_percolation_timeline",
];

const DEFAULT_DESELECTED_JOB_KEYS: DataPipelineRefreshJobKey[] = [
  "universe_memberships_sync",
  "ticker_core_sync",
  "macro_fred_series_sync",
  "ticker_daily_price_history_sync",
  "sec_bulk_ingest",
  "metric_series",
  "sec_metric_series_experiment",
  "series_validation",
  ...PREPARED_SERIES_JOB_KEYS,
  ...EXPECTATION_JOB_KEYS,
  ...FEATURE_JOB_KEYS,
  ...SIGNAL_JOB_KEYS,
];

const DEFAULT_SELECTED_JOB_KEYS = DATA_PIPELINE_REFRESH_JOB_KEYS.filter(
  (job) => !DEFAULT_DESELECTED_JOB_KEYS.includes(job),
);

function formatLocalDateTime(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const offsetMinutes = -date.getTimezoneOffset();
  const offsetSign = offsetMinutes >= 0 ? "+" : "-";
  const offsetHours = String(Math.floor(Math.abs(offsetMinutes) / 60)).padStart(
    2,
    "0",
  );
  const offsetRemainderMinutes = String(Math.abs(offsetMinutes) % 60).padStart(
    2,
    "0",
  );

  return `${date.toLocaleString()} GMT${offsetSign}${offsetHours}:${offsetRemainderMinutes}`;
}

function formatFileSizeGb(value?: string | number | null) {
  if (value === null || value === undefined) return "-";

  const bytes = Number(value);

  if (!Number.isFinite(bytes)) return String(value);

  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function parseTickerInput(value: string): string[] {
  const seen = new Set<string>();
  const tickers: string[] = [];

  for (const part of value.split(/[\s,]+/)) {
    const ticker = part.trim().toUpperCase();

    if (!ticker || seen.has(ticker)) continue;

    seen.add(ticker);
    tickers.push(ticker);
  }

  return tickers;
}

function formatDataPipelineJobLabel(job: DataPipelineRefreshJobKey) {
  return DATA_PIPELINE_REFRESH_JOB_LABELS[job] ?? job;
}

function formatLockGroupLabel(group: string) {
  const labels: Record<string, string> = {
    universe_memberships: "Universe memberships",
    ticker_core: "Company profile",
    macro_fred: "Macro FRED",
    daily_price_history: "Daily price history",
    sec_companyfacts: "SEC Companyfacts",
    derived_metrics: "Derived metrics",
    factor_features: "Factor features",
    factor_outputs: "Factor outputs",
  };

  return labels[group] ?? group;
}

function getLockGroupsForJobs(jobs: DataPipelineRefreshJobKey[]) {
  const groups = new Set<DataPipelineLockGroup>();

  for (const job of jobs) {
    for (const group of getLockGroupsForJob(job)) {
      groups.add(group);
    }
  }

  return [...groups];
}

function getLockGroupsForJob(job: DataPipelineRefreshJobKey): DataPipelineLockGroup[] {
  switch (job) {
    case "universe_memberships_sync":
      return ["universe_memberships"];
    case "ticker_core_sync":
      return ["ticker_core"];
    case "macro_fred_series_sync":
      return ["macro_fred"];
    case "ticker_daily_price_history_sync":
      return ["daily_price_history"];
    case "sec_bulk_ingest":
    case "metric_series":
    case "sec_metric_series_experiment":
    case "series_validation":
    case "sec_metric_series_enriched":
      return ["sec_companyfacts"];
    case "derived_metric_series":
      return [
        "derived_metrics",
        "daily_price_history",
        "sec_companyfacts",
        "macro_fred",
      ];
    case "ticker_implied_financial_expectations":
      return ["derived_metrics"];
    case "fundamentals_based_factor_features":
      return ["factor_features", "sec_companyfacts"];
    case "valuation_factor_features":
      return ["factor_features", "derived_metrics"];
    case "market_price_factor_features":
    case "etf_exposure_factor_features":
      return ["factor_features", "daily_price_history"];
    case "macro_linked_factor_features":
      return ["factor_features", "sec_companyfacts", "macro_fred"];
    case "factor_signals":
    case "signal_percolation_timeline":
      return ["factor_outputs", "factor_features"];
  }
}

function formatDuration(valueMs?: number | null) {
  if (valueMs === null || valueMs === undefined || valueMs < 0) return "-";

  const totalSeconds = Math.floor(valueMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

function getDurationBetweenMs(
  startedAt?: string | null,
  finishedAt?: string | null,
) {
  if (!startedAt || !finishedAt) return null;

  const started = new Date(startedAt).getTime();
  const finished = new Date(finishedAt).getTime();

  if (!Number.isFinite(started) || !Number.isFinite(finished)) return null;

  return Math.max(0, finished - started);
}

export function DataPipelineRefreshPanel() {
  const [secBulkState, setSecBulkState] =
    useState<SecBulkIngestState | null>(null);

  const [selectedJobs, setSelectedJobs] =
    useState<DataPipelineRefreshJobKey[]>([
      ...DEFAULT_SELECTED_JOB_KEYS,
    ]);

  const [databaseSizeReport, setDatabaseSizeReport] =
    useState<DatabaseSizeReport | null>(null);
  const [secBulkStateError, setSecBulkStateError] = useState<string | null>(
    null,
  );
  const [databaseSizeReportError, setDatabaseSizeReportError] = useState<
    string | null
  >(null);

  const [rebuildMode] = useState<DataPipelineRebuildMode>("all");
  const [companyScope, setCompanyScope] =
    useState<DataPipelineCompanyScope>("bulk_changed");
  const [secTagCandidateDiscovery, setSecTagCandidateDiscovery] =
    useState(false);
  const [
    secMetricSeriesExperimentMaxCiks,
    setSecMetricSeriesExperimentMaxCiks,
  ] = useState(50);
  const [
    secMetricSeriesExperimentClearBeforeRun,
    setSecMetricSeriesExperimentClearBeforeRun,
  ] = useState(false);
  const [universeRefreshMode] =
    useState<DataPipelineUniverseRefreshMode>("skip");
  const [selectedUniverseKeys, setSelectedUniverseKeys] =
    useState<UniverseKey[]>([...DEFAULT_UNIVERSE_KEYS]);
  const [tickerCoreSyncMode] =
    useState<DataPipelineTickerCoreSyncMode>("skip");
  const [tickerCoreMaxRequests, setTickerCoreMaxRequests] = useState(200);
  const [tickerCoreTickerInput, setTickerCoreTickerInput] = useState("");
  const [tickerCoreTargetMode, setTickerCoreTargetMode] =
    useState<TickerCoreTargetMode>("universe");
  const [tickerDailyPriceYearsBack, setTickerDailyPriceYearsBack] = useState(30);
  const [tickerDailyPriceMaxTickers, setTickerDailyPriceMaxTickers] =
    useState(350);
  const [tickerDailyPriceMaxRequests, setTickerDailyPriceMaxRequests] =
    useState(700);
  const [tickerDailyPriceTickerInput, setTickerDailyPriceTickerInput] =
    useState("");
  const [tickerDailyPriceTargetMode, setTickerDailyPriceTargetMode] =
    useState<TickerDailyPriceTargetMode>("universe");
  const [signalPercolationAxisScopes, setSignalPercolationAxisScopes] =
    useState<SignalTimelineAxisScope[]>([]);
  const [
    signalPercolationClearBeforeRun,
    setSignalPercolationClearBeforeRun,
  ] = useState(false);

  const [status, setStatus] = useState<PipelineStatus>({
    status: "idle",
  });

  const [isTriggering, setIsTriggering] = useState(false);
  const [activeButtonAction, setActiveButtonAction] =
    useState<ButtonAction | null>(null);
  const [buttonNotice, setButtonNotice] = useState<{
    action: ButtonAction;
    message: string;
  } | null>(null);
  const [statusPollIntervalMs, setStatusPollIntervalMs] = useState(30_000);
  const [hasMounted, setHasMounted] = useState(false);
  const buttonNoticeTimeoutRef = useRef<number | null>(null);
  const shouldPollStatusRef = useRef(false);
  const lastStatusRef = useRef<PipelineStatus["status"]>("idle");

  const isRunning = status.status === "running";
  const isSignalPercolationSelected = selectedJobs.includes(
    "signal_percolation_timeline",
  );
  const hasSignalPercolationAxisScope =
    !isSignalPercolationSelected ||
    signalPercolationAxisScopes.length > 0;
  const tickerCoreInputTickers = parseTickerInput(tickerCoreTickerInput);
  const tickerCoreTickers =
    tickerCoreTargetMode === "specific" ? tickerCoreInputTickers : [];
  const tickerDailyPriceInputTickers = parseTickerInput(tickerDailyPriceTickerInput);
  const tickerDailyPriceTickers =
    tickerDailyPriceTargetMode === "specific"
      ? tickerDailyPriceInputTickers
      : [];
  const areAllSecCompanyfactJobsSelected = SEC_COMPANYFACT_JOB_KEYS.every(
    (job) => selectedJobs.includes(job),
  );
  const isSecBulkActive =
    secBulkState?.archive_status === "downloading" ||
    secBulkState?.ingest_status === "running";
  const displayStatus = isRunning
    ? status.status
    : isSecBulkActive
      ? "running"
      : status.status;
  const displayMessage = isRunning
    ? status.message
    : isSecBulkActive
      ? secBulkState.ingest_status === "running"
        ? "SEC bulk ingest is running."
        : "SEC bulk archive download is running."
      : status.message;
  const statusDurationMs = getDurationBetweenMs(
    status.startedAt,
    status.finishedAt ?? (isRunning ? new Date().toISOString() : null),
  );
  shouldPollStatusRef.current = isRunning || isTriggering;

  function showButtonNotice(action: ButtonAction, message: string) {
    setButtonNotice({
      action,
      message,
    });

    if (buttonNoticeTimeoutRef.current !== null) {
      window.clearTimeout(buttonNoticeTimeoutRef.current);
    }

    buttonNoticeTimeoutRef.current = window.setTimeout(() => {
      setButtonNotice(null);
      buttonNoticeTimeoutRef.current = null;
    }, 3000);
  }

  const loadSecBulkState = useCallback(async () => {
    try {
      const data = await fetchSecBulkIngestState();
      setSecBulkState(data);
      setSecBulkStateError(null);
    } catch {
      setSecBulkStateError("Failed to load SEC bulk state.");
    }
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const data = await fetchPipelineStatus();
      const shouldRefreshSecBulkState =
        lastStatusRef.current === "running" && data.status !== "running";
      lastStatusRef.current = data.status;
      setStatus(data);

      if (shouldRefreshSecBulkState) {
        void loadSecBulkState();
      }
    } catch {
      lastStatusRef.current = "failed";
      setStatus({
        status: "failed",
        error: "Failed to load pipeline status.",
      });
    }
  }, [loadSecBulkState]);

  const loadDatabaseSizeReport = useCallback(async () => {
    try {
      const data = await fetchDatabaseSizeReport();
      setDatabaseSizeReport(data);
      setDatabaseSizeReportError(null);
    } catch {
      setDatabaseSizeReportError("Failed to load database size report.");
    }
  }, []);
  async function runRefresh(targetSlot: number) {
    const shouldClearSignalPercolation =
      isSignalPercolationSelected && signalPercolationClearBeforeRun;

    if (shouldClearSignalPercolation) {
      const confirmed = window.confirm(
        `Delete stored signal percolation timeline snapshots and forward returns for the selected lenses, then rebuild in slot ${targetSlot}?`,
      );

      if (!confirmed) return;
    }

    setIsTriggering(true);
    setActiveButtonAction("run");

    try {
      const refreshJobs: DataPipelineRefreshJobKey[] = selectedJobs.includes(
        "sec_bulk_ingest",
      )
        ? selectedJobs.includes("metric_series")
          ? selectedJobs
          : [...selectedJobs, "metric_series"]
        : selectedJobs.filter((job) => job !== "metric_series");

      const response = await triggerDataPipelineRefresh({
        jobs: refreshJobs,
        rebuild: true,
        rebuildMode,
        companyScope,
        universeRefreshMode: selectedJobs.includes("universe_memberships_sync")
          ? "selected"
          : universeRefreshMode,
        universeKeys: selectedUniverseKeys,
        tickerCoreSyncMode: selectedJobs.includes("ticker_core_sync")
          ? "missing_or_stale"
          : tickerCoreSyncMode,
        tickerCoreMaxRequests,
        tickerCoreTickers,
        secTagCandidateDiscovery,
        tickerDailyPriceEndDate: "2026-05-05",
        tickerDailyPriceYearsBack,
        tickerDailyPriceMaxTickers,
        tickerDailyPriceMaxRequests,
        tickerDailyPriceTickers,
        signalPercolationAxisScopes,
        signalPercolationClearBeforeRun: shouldClearSignalPercolation,
        targetSlot,
      });

      if (response.status === 409) {
        const result = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        const message =
          result?.message ?? "Data pipeline refresh is already running.";

        setStatus({
          status: "running",
          message,
        });
        lastStatusRef.current = "running";
        showButtonNotice("run", message);
        return;
      }

      if (!response.ok) {
        throw new Error("Refresh trigger failed.");
      }

      setStatus({
        status: "running",
        message: `Data pipeline refresh started in slot ${targetSlot}.`,
        startedAt: new Date().toISOString(),
      });
      lastStatusRef.current = "running";
      showButtonNotice("run", `Pipeline refresh started in slot ${targetSlot}.`);
    } catch {
      lastStatusRef.current = "failed";
      setStatus({
        status: "failed",
        error: "Failed to trigger pipeline refresh.",
      });
      showButtonNotice("run", "Failed to trigger pipeline refresh.");
    } finally {
      setIsTriggering(false);
      setActiveButtonAction(null);
    }
  }

  async function runTagExperiment() {
    setIsTriggering(true);
    setActiveButtonAction("tagExperiment");

    try {
      const response = await triggerDataPipelineRefresh({
        jobs: ["sec_metric_series_experiment"],
        rebuild: true,
        rebuildMode,
        companyScope,
        universeRefreshMode: selectedJobs.includes("universe_memberships_sync")
          ? "selected"
          : universeRefreshMode,
        universeKeys: selectedUniverseKeys,
        tickerCoreSyncMode,
        tickerCoreMaxRequests,
        tickerCoreTickers: [],
        secTagCandidateDiscovery: false,
        secMetricSeriesExperimentMaxCiks,
        secMetricSeriesExperimentClearBeforeRun,
        tickerDailyPriceEndDate: "2026-05-05",
        tickerDailyPriceYearsBack,
        tickerDailyPriceMaxTickers,
        tickerDailyPriceMaxRequests,
        tickerDailyPriceTickers: [],
        signalPercolationAxisScopes,
        signalPercolationClearBeforeRun: false,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message ?? "Failed to start tag experiment.");
      }

      const data = await response.json().catch(() => null);
      showButtonNotice(
        "tagExperiment",
        data?.status === "started"
          ? `Tag experiment started in slot ${data.slot ?? "-"}.`
          : "Tag experiment started.",
      );
      shouldPollStatusRef.current = true;
      await loadStatus();
    } catch (error) {
      showButtonNotice(
        "tagExperiment",
        error instanceof Error ? error.message : "Failed to start tag experiment.",
      );
    } finally {
      setIsTriggering(false);
      setActiveButtonAction(null);
    }
  }

  async function refreshStatusFromButton() {
    setActiveButtonAction("status");
    await loadStatus();
    showButtonNotice("status", "Status refreshed.");
    setActiveButtonAction(null);
  }

  async function refreshSecBulkStateFromButton() {
    setActiveButtonAction("secBulk");
    await loadSecBulkState();
    showButtonNotice("secBulk", "SEC bulk state refreshed.");
    setActiveButtonAction(null);
  }

  async function refreshDatabaseSizeFromButton() {
    setActiveButtonAction("dbSize");
    await loadDatabaseSizeReport();
    showButtonNotice("dbSize", "Database size refreshed.");
    setActiveButtonAction(null);
  }

  useEffect(() => {
    setHasMounted(true);
    void loadStatus();
    void loadSecBulkState();
    void loadDatabaseSizeReport();
  }, [loadDatabaseSizeReport, loadSecBulkState, loadStatus]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (!shouldPollStatusRef.current) return;

      void loadStatus();
    }, statusPollIntervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadStatus, statusPollIntervalMs]);

  useEffect(() => {
    return () => {
      if (buttonNoticeTimeoutRef.current !== null) {
        window.clearTimeout(buttonNoticeTimeoutRef.current);
      }
    };
  }, []);

  function toggleSecCompanyfactJobs() {
    setSelectedJobs((current) => {
      const allSelected = SEC_COMPANYFACT_JOB_KEYS.every((job) =>
        current.includes(job),
      );

      if (allSelected) {
        return current.filter((job) => !SEC_COMPANYFACT_JOB_KEYS.includes(job));
      }

      return DATA_PIPELINE_REFRESH_JOB_KEYS.filter(
        (job) => current.includes(job) || SEC_COMPANYFACT_JOB_KEYS.includes(job),
      );
    });
  }

  function renderJobCheckbox(job: DataPipelineRefreshJobKey) {
    const isSignalPercolationJob = job === "signal_percolation_timeline";

    return (
      <label key={job} className="block bg-[#f5f5f5] p-2 text-sm">
        <span className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={selectedJobs.includes(job)}
            onChange={(event) => {
              if (isSignalPercolationJob) {
                setSignalPercolationAxisScopes(
                  event.target.checked
                    ? SIGNAL_TIMELINE_AXIS_SCOPE_OPTIONS.map((option) => option.key)
                    : [],
                );
                if (!event.target.checked) {
                  setSignalPercolationClearBeforeRun(false);
                }
              }

              setSelectedJobs((current) =>
                event.target.checked
                  ? [...current, job]
                  : current.filter((item) => item !== job),
              );
            }}
          />
          <span>
            <span className="block font-bold">
              {DATA_PIPELINE_REFRESH_JOB_LABELS[job]}
            </span>
            <span className="block text-xs text-gray-600">
              {DATA_PIPELINE_REFRESH_JOB_DESCRIPTIONS[job]}
            </span>
            {job === "sec_bulk_ingest" ? (
              <ol className="mt-2 space-y-1 border-l border-gray-400 pl-4 text-[11px] leading-4 text-gray-600">
                <li>1. Stage raw companyfacts rows per CIK.</li>
                <li>2. Build fiscal and metric sign profiles.</li>
                <li>3. Extract transient tag rows and optional candidate stats.</li>
                <li>4. Build persistent metric series, then delete tag/raw rows.</li>
              </ol>
            ) : null}
            {isSignalPercolationJob ? (
              <div className="mt-3 border-t border-gray-300 pt-2">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gray-600">
                  Axis lenses to calculate
                </div>
                <div className="grid gap-1">
                  {SIGNAL_TIMELINE_AXIS_SCOPE_OPTIONS.map((option) => {
                    const checked = signalPercolationAxisScopes.includes(
                      option.key,
                    );

                    return (
                      <label key={option.key} className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => {
                            const nextChecked = event.target.checked;

                            setSignalPercolationAxisScopes((current) => {
                              const next = nextChecked
                                ? [...current, option.key].filter(
                                    (value, index, values) =>
                                      values.indexOf(value) === index,
                                  )
                                : current.filter((value) => value !== option.key);

                              setSelectedJobs((currentJobs) => {
                                if (next.length === 0) {
                                  setSignalPercolationClearBeforeRun(false);
                                  return currentJobs.filter((item) => item !== job);
                                }

                                return currentJobs.includes(job)
                                  ? currentJobs
                                  : [...currentJobs, job];
                              });

                              return next;
                            });
                          }}
                        />
                        <span>
                          <span className="block font-bold">{option.label}</span>
                          <span className="block text-[11px] text-gray-600">
                            {option.axes?.join(" + ") ?? "all signal axes"}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                {selectedJobs.includes(job) &&
                signalPercolationAxisScopes.length === 0 ? (
                  <p className="mt-2 text-[11px] text-amber-700">
                    Select at least one lens before running this job.
                  </p>
                ) : null}
              </div>
            ) : null}
          </span>
        </span>
      </label>
    );
  }

	return (
		<main className="w-full max-w-none space-y-4 p-4 lg:p-6">
			<section className="border border-black bg-white p-4">
				<h1 className="text-xl font-bold">Startup / Data Pipeline</h1>
				<p className="mt-2 text-sm text-gray-700">
					Manually trigger and monitor the data pipeline refresh workflow.
				</p>
			</section>
			<div className="grid gap-4 xl:grid-cols-[minmax(420px,0.9fr)_minmax(640px,1.4fr)]">
				<section className="space-y-3 border border-black bg-[#f5f5f5] p-4">
					<h2 className="font-bold">Current Status</h2>
					<div className="text-sm">
						<p>
							<span className="font-bold">Status:</span> {displayStatus}
						</p>
						{displayMessage ? (
							<p>
								<span className="font-bold">Message:</span> {displayMessage}
							</p>
						) : null}
						{status.currentJob ? (
							<p>
								<span className="font-bold">Current job:</span>{" "}
								{formatDataPipelineJobLabel(status.currentJob)}
							</p>
						) : null}
						{status.progress ? (
							<p>
								<span className="font-bold">Progress:</span>{" "}
								{status.progress.current ?? "-"} / {status.progress.total ?? "-"}
								{status.progress.label ? ` (${status.progress.label})` : ""}
							</p>
						) : null}
						{status.startedAt ? (
							<p>
								<span className="font-bold">Started:</span>{" "}
								{formatLocalDateTime(status.startedAt)}
							</p>
						) : null}
						{status.finishedAt ? (
							<p>
								<span className="font-bold">Finished:</span>{" "}
								{formatLocalDateTime(status.finishedAt)}
							</p>
						) : null}
						{statusDurationMs !== null ? (
							<p>
								<span className="font-bold">
									{isRunning ? "Elapsed:" : "Duration:"}
								</span>{" "}
								{formatDuration(statusDurationMs)}
							</p>
						) : null}
						{status.updatedAt ? (
							<p>
								<span className="font-bold">Updated:</span>{" "}
								{formatLocalDateTime(status.updatedAt)}
							</p>
						) : null}
						{status.error ? (
							<p className="text-red-700">
								<span className="font-bold">Error:</span> {status.error}
							</p>
						) : null}
						{secBulkState ? (
							<p>
								<span className="font-bold">SEC bulk:</span>{" "}
								archive={secBulkState.archive_status}, ingest=
								{secBulkState.ingest_status}
							</p>
						) : null}
					</div>
					<div className="grid gap-2 text-xs sm:grid-cols-2">
						{[1, 2].map((slot) => {
							const run = status.activeRuns?.find(
								(activeRun) => activeRun.slot === slot,
							);
							const completedRun = status.completedRuns
								?.filter((item) => item.slot === slot)
								.slice(-1)[0];
							const selectedGroups = getLockGroupsForJobs(selectedJobs);
							const activeGroups = new Set(
								status.activeRuns?.flatMap((activeRun) => activeRun.groups) ??
									[],
							);
							const conflictingGroups = selectedGroups.filter((group) =>
								activeGroups.has(group),
							);
							const isSlotStarting =
								isTriggering && activeButtonAction === "run";
							const hasSelectedJobConflict = conflictingGroups.length > 0;
							const isRunDisabled =
								Boolean(run) ||
								isTriggering ||
								selectedJobs.length === 0 ||
								!hasSignalPercolationAxisScope ||
								hasSelectedJobConflict ||
								activeButtonAction !== null;

							return (
								<div
									key={slot}
									className="border border-black bg-white p-2"
								>
									<div className="flex items-center justify-between gap-2">
										<h3 className="font-bold">Slot {slot}</h3>
										<span
											className={
												run
													? "font-bold text-green-700"
													: "text-gray-500"
											}
										>
											{run ? "running" : "idle"}
										</span>
									</div>
									{run ? (
										<div className="mt-2 space-y-1">
											<p>
												<span className="font-bold">Started:</span>{" "}
												{formatLocalDateTime(run.startedAt)}
											</p>
											<p>
												<span className="font-bold">Age:</span>{" "}
												{formatDuration(run.ageMs)}
											</p>
											<p>
												<span className="font-bold">Jobs:</span>{" "}
												{run.jobs.map(formatDataPipelineJobLabel).join(", ")}
											</p>
										</div>
									) : (
										<div className="mt-2 space-y-1 text-gray-600">
											{completedRun ? (
												<>
													<p>
														<span className="font-bold">Last result:</span>{" "}
														<span
															className={
																completedRun.status === "success"
																	? "text-green-700"
																	: "text-red-700"
															}
														>
															{completedRun.status}
														</span>
													</p>
													<p>
														<span className="font-bold">Started:</span>{" "}
														{formatLocalDateTime(completedRun.startedAt)}
													</p>
													<p>
														<span className="font-bold">Finished:</span>{" "}
														{formatLocalDateTime(completedRun.finishedAt)}
													</p>
													<p>
														<span className="font-bold">Duration:</span>{" "}
														{formatDuration(completedRun.durationMs)}
													</p>
													<p>
														<span className="font-bold">Jobs:</span>{" "}
														{completedRun.jobs
															.map(formatDataPipelineJobLabel)
															.join(", ")}
													</p>
												</>
											) : (
												<p>No active run.</p>
											)}
										</div>
									)}
									<button
										type="button"
										onClick={() => runRefresh(slot)}
										disabled={isRunDisabled}
										className="mt-2 w-full border border-black bg-[#c0c0c0] px-3 py-1 text-xs font-bold disabled:opacity-50"
									>
										{run
											? "Running..."
											: hasSelectedJobConflict
												? "Blocked"
											: isSlotStarting
												? "Starting..."
												: `Run in slot ${slot}`}
									</button>
									{!run && hasSelectedJobConflict ? (
										<p className="mt-1 text-[11px] text-amber-700">
											Selected jobs conflict with running group:{" "}
											{conflictingGroups
												.map(formatLockGroupLabel)
												.join(", ")}
											.
										</p>
									) : null}
								</div>
							);
						})}
					</div>
					{status.events?.length ? (
						<div className="max-h-72 overflow-auto border border-black bg-white p-2 text-xs xl:max-h-[58vh]">
							<h3 className="mb-2 font-bold">Recent Progress</h3>
							<ul className="space-y-1">
								{[...status.events].reverse().slice(0, 30).map((event) => (
									<li
										key={`${event.timestamp}-${event.message}`}
										className={
											event.level === "error"
												? "text-red-700"
												: event.level === "warning"
													? "text-amber-700"
													: undefined
										}
									>
										<span className="font-mono">
											{formatLocalDateTime(event.timestamp)}
										</span>{" "}
										{event.job ? (
											<span>[{formatDataPipelineJobLabel(event.job)}] </span>
										) : null}
										<span>{event.message}</span>
									</li>
								))}
							</ul>
						</div>
					) : null}
					<div className="flex flex-wrap gap-2 border-t border-black pt-3">
						{buttonNotice?.action === "run" ? (
							<p className="basis-full text-xs text-gray-600" aria-live="polite">
								{buttonNotice.message}
							</p>
						) : null}
						<label className="flex items-center gap-2 border border-black bg-white px-3 py-1 text-xs">
							<span className="font-bold">Auto refresh</span>
							<select
								value={statusPollIntervalMs}
								onChange={(event) => {
									setStatusPollIntervalMs(Number(event.target.value));
								}}
								className="border border-black bg-white px-1 py-0.5 font-mono"
							>
								{STATUS_POLL_INTERVAL_OPTIONS.map((option) => (
									<option key={option.value} value={option.value}>
										{option.label}
									</option>
								))}
							</select>
						</label>
						<div className="flex flex-col gap-1">
							<button
								type="button"
								onClick={refreshStatusFromButton}
								disabled={activeButtonAction !== null}
								className="border border-black bg-white px-3 py-1 text-xs font-bold disabled:opacity-50"
							>
								{activeButtonAction === "status"
									? "Refreshing..."
									: "Refresh status"}
							</button>
							{buttonNotice?.action === "status" ? (
								<p className="text-xs text-gray-600" aria-live="polite">
									{buttonNotice.message}
								</p>
							) : null}
						</div>
					</div>
				</section>
				<section className="space-y-2 border border-black bg-white p-4 xl:row-span-2">
					<h2 className="font-bold">Jobs</h2>
					{hasMounted ? (
						<div className="space-y-4">
							<div className="space-y-2 border-t border-black pt-3">
								<h3 className="font-bold">Universe Memberships</h3>
								<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
									{UNIVERSE_MEMBERSHIP_JOB_KEYS.map(renderJobCheckbox)}
								</div>
								<div className="space-y-2 bg-[#f7f7f7] p-3 text-sm">
									<div className="text-[11px] font-bold uppercase tracking-wide text-gray-600">
										Memberships selected
									</div>
									<div className="grid gap-2 sm:grid-cols-3">
										{UNIVERSE_KEYS.map((universeKey) => (
											<label key={universeKey} className="block">
												<input
													type="checkbox"
													checked={selectedUniverseKeys.includes(universeKey)}
													onChange={(event) => {
														setSelectedUniverseKeys((current) =>
															event.target.checked
																? [...current, universeKey]
																: current.filter((item) => item !== universeKey),
														);
													}}
												/>{" "}
												{UNIVERSE_LABELS[universeKey]}
											</label>
										))}
									</div>
								</div>
								<p className="text-xs text-gray-600">
									If this job is unchecked, downstream jobs use stored active
									memberships for the selected universes. If checked, selected
									memberships sync first. S&amp;P 500, S&amp;P 400, S&amp;P 600,
									and DJIA use ETF holdings files.
								</p>
							</div>
							<div className="space-y-2 border-t border-black pt-3">
								<h3 className="font-bold">Company Profile &amp; Classification</h3>
								<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
									{COMPANY_PROFILE_JOB_KEYS.map(renderJobCheckbox)}
								</div>
								<label className="block text-sm">
									Max provider requests{" "}
									<input
										type="number"
										min={1}
										max={250}
										value={tickerCoreMaxRequests}
										onChange={(event) => {
											const value = Number(event.target.value);
											setTickerCoreMaxRequests(
												Number.isFinite(value)
													? Math.min(250, Math.max(1, Math.trunc(value)))
													: 200,
											);
										}}
										className="ml-2 w-24 border border-black px-2 py-1"
									/>
								</label>
								<div className="space-y-2 text-sm">
									<div className="grid gap-2 sm:grid-cols-2">
										<label className="block border border-black bg-white p-2">
											<input
												type="radio"
												name="tickerCoreTargetMode"
												value="universe"
												checked={tickerCoreTargetMode === "universe"}
												onChange={() => setTickerCoreTargetMode("universe")}
											/>{" "}
											Selected universe memberships
										</label>
										<label className="block border border-black bg-white p-2">
											<input
												type="radio"
												name="tickerCoreTargetMode"
												value="specific"
												checked={tickerCoreTargetMode === "specific"}
												onChange={() => setTickerCoreTargetMode("specific")}
											/>{" "}
											Specific tickers
										</label>
									</div>
									<textarea
										value={tickerCoreTickerInput}
										onChange={(event) => {
											const value = event.target.value;
											setTickerCoreTickerInput(value);
											setTickerCoreTargetMode(
												parseTickerInput(value).length > 0
													? "specific"
													: "universe",
											);
										}}
										placeholder="AAPL, MSFT, NVDA"
										rows={2}
										className="mt-1 block w-full border border-black px-2 py-1 font-mono text-xs"
									/>
									<span className="mt-1 block text-xs text-gray-600">
										Specific tickers refresh directly through FMP in input
										order after duplicate removal. Max provider requests still
										caps how many tickers run.
									</span>
								</div>
								<p className="text-xs text-gray-600">
									If this job is unchecked, downstream jobs use stored company
									profiles and classifications. If checked with selected
									universes, only missing or stale records are fetched. If checked
									with specific tickers, those tickers are refreshed directly.
									Free FMP accounts allow 250 calls per day, so the default
									request cap is 200.
								</p>
							</div>
							<div className="space-y-2 border-t border-black pt-3">
								<h3 className="font-bold">Market Data</h3>
								<p className="text-xs text-gray-600">
									External market and macro data collection for downstream
									features. Feature calculations run later in Features.
								</p>
								<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
									{MARKET_DATA_JOB_KEYS.map(renderJobCheckbox)}
								</div>
								<div className="grid gap-2 text-sm sm:grid-cols-3">
									<label className="block">
										Years back{" "}
										<input
											type="number"
											min={1}
											max={50}
											value={tickerDailyPriceYearsBack}
											onChange={(event) => {
												const value = Number(event.target.value);
												setTickerDailyPriceYearsBack(
													Number.isFinite(value)
														? Math.min(50, Math.max(1, Math.trunc(value)))
														: 30,
												);
											}}
											className="mt-1 block w-24 border border-black px-2 py-1"
										/>
									</label>
									<label className="block">
										Max tickers{" "}
										<input
											type="number"
											min={1}
											max={500}
											value={tickerDailyPriceMaxTickers}
											onChange={(event) => {
												const value = Number(event.target.value);
												setTickerDailyPriceMaxTickers(
													Number.isFinite(value)
														? Math.min(500, Math.max(1, Math.trunc(value)))
														: 350,
												);
											}}
											className="mt-1 block w-24 border border-black px-2 py-1"
										/>
									</label>
									<label className="block">
										Max requests{" "}
										<input
											type="number"
											min={1}
											max={800}
											value={tickerDailyPriceMaxRequests}
											onChange={(event) => {
												const value = Number(event.target.value);
												setTickerDailyPriceMaxRequests(
													Number.isFinite(value)
														? Math.min(800, Math.max(1, Math.trunc(value)))
														: 700,
												);
											}}
											className="mt-1 block w-24 border border-black px-2 py-1"
										/>
									</label>
								</div>
								<div className="space-y-2 text-sm">
									<div className="grid gap-2 sm:grid-cols-2">
										<label className="block border border-black bg-white p-2">
											<input
												type="radio"
												name="tickerDailyPriceTargetMode"
												value="universe"
												checked={tickerDailyPriceTargetMode === "universe"}
												onChange={() =>
													setTickerDailyPriceTargetMode("universe")
												}
											/>{" "}
											Selected universe memberships
										</label>
										<label className="block border border-black bg-white p-2">
											<input
												type="radio"
												name="tickerDailyPriceTargetMode"
												value="specific"
												checked={tickerDailyPriceTargetMode === "specific"}
												onChange={() =>
													setTickerDailyPriceTargetMode("specific")
												}
											/>{" "}
											Specific tickers
										</label>
									</div>
									<textarea
										value={tickerDailyPriceTickerInput}
										onChange={(event) => {
											const value = event.target.value;
											setTickerDailyPriceTickerInput(value);
											setTickerDailyPriceTargetMode(
												parseTickerInput(value).length > 0
													? "specific"
													: "universe",
											);
										}}
										placeholder="AAPL, MSFT, NVDA"
										rows={2}
										className="mt-1 block w-full border border-black px-2 py-1 font-mono text-xs"
									/>
									<span className="mt-1 block text-xs text-gray-600">
										Typing a ticker switches to Specific tickers. Clear the
										input or select universe memberships to use the selected
										universe list.
									</span>
								</div>
							</div>
							<div className="space-y-2 border-t border-black pt-3">
								<div className="flex items-center gap-3">
									<h3 className="font-bold">SEC Companyfacts / Series</h3>
									<button
										type="button"
										onClick={toggleSecCompanyfactJobs}
										className="border border-black bg-white px-3 py-1 text-xs font-bold"
									>
										{areAllSecCompanyfactJobsSelected
											? "Clear all"
											: "Select all"}
									</button>
								</div>
								<p className="text-xs text-gray-600">
									SEC bulk ingest now includes metric-series creation. Tag rows
									are transient; metric series is the lowest retained SEC
									companyfacts series layer. Validation is optional, and enriched
									tables run later in Enriched Outputs.
								</p>
								<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
									{SEC_COMPANYFACT_JOB_KEYS.map(renderJobCheckbox)}
								</div>
								<div className="ml-4 grid grid-cols-[auto_1fr] gap-x-2">
									<CornerDownRight
										className="mt-3 h-4 w-4 text-gray-500"
										aria-hidden="true"
									/>
									<div className="space-y-2 bg-[#f7f7f7] p-3">
										<div>
											<h4 className="text-xs font-bold uppercase tracking-wide text-gray-700">
												SEC Company Scope
											</h4>
											<p className="mt-1 text-[11px] leading-4 text-gray-600">
												Applies to SEC bulk ingest, metric series, series
												validation, SEC enriched outputs, derived metric series,
												and SEC/valuation feature jobs. Fiscal profile and tag
												extraction are internal SEC bulk ingest steps because
												they require temporary raw rows.
											</p>
										</div>
										<div className="grid gap-2 sm:grid-cols-2">
											<label
												className={`block border p-2 text-xs ${
													companyScope === "all"
														? "border-black bg-white"
														: "border-gray-300 bg-[#fbfbfb]"
												}`}
											>
												<span className="flex items-start gap-2">
													<input
														type="radio"
														name="companyScope"
														value="all"
														checked={companyScope === "all"}
														onChange={() => setCompanyScope("all")}
													/>
													<span>
														<span className="block font-bold">
															All SEC companies
														</span>
														<span className="block text-[11px] leading-4 text-gray-600">
															Reread every mapped CIK from the SEC archive, then
															run selected SEC-driven jobs across the full mapped
															set. Price-history sync still follows Market Data
															settings.
														</span>
													</span>
												</span>
											</label>
											<label
												className={`block border p-2 text-xs ${
													companyScope === "bulk_changed"
														? "border-black bg-white"
														: "border-gray-300 bg-[#fbfbfb]"
												}`}
											>
												<span className="flex items-start gap-2">
													<input
														type="radio"
														name="companyScope"
														value="bulk_changed"
														checked={companyScope === "bulk_changed"}
														onChange={() => setCompanyScope("bulk_changed")}
													/>
													<span>
														<span className="block font-bold">
															Latest bulk changes
														</span>
														<span className="block text-[11px] leading-4 text-gray-600">
															Read only new or file-size-changed CIKs, then run
															selected SEC-driven jobs for that changed set.
															Daily-price jobs use explicit tickers, just-processed
															price tickers, or price-state changes instead.
														</span>
													</span>
												</span>
											</label>
										</div>
										<div className="border-t border-gray-300 pt-2 text-[11px] leading-4 text-gray-600">
											A no-change bulk skip produces an empty changed-company
											scope. Use All SEC companies for full rebuilds after logic
											changes. When SEC-driven and price-driven jobs run together,
											downstream signals use the union of SEC changed tickers and
											price changed tickers.
										</div>
										<label className="flex items-start gap-2 border-t border-gray-300 pt-2 text-xs">
											<input
												type="checkbox"
												checked={secTagCandidateDiscovery}
												onChange={(event) =>
													setSecTagCandidateDiscovery(event.target.checked)
												}
												disabled={!selectedJobs.includes("sec_bulk_ingest")}
											/>
											<span>
												<span className="block font-bold">
													Collect tag candidate stats
												</span>
												<span className="block text-[11px] leading-4 text-gray-600">
													While each CIK raw rows are staged, aggregate
													unmapped us-gaap tags into candidate stats before raw
													and tag cleanup. This does not keep raw rows.
												</span>
											</span>
										</label>
										<div className="space-y-2 border-t border-gray-300 pt-2 text-xs">
											<div className="flex flex-wrap items-end gap-2">
												<label className="block">
													<span className="block font-bold">
														Tag experiment max CIKs
													</span>
													<input
														type="number"
														min={1}
														max={500}
														value={secMetricSeriesExperimentMaxCiks}
														onChange={(event) => {
															const value = Number(event.target.value);
															setSecMetricSeriesExperimentMaxCiks(
																Number.isFinite(value)
																	? Math.min(500, Math.max(1, Math.trunc(value)))
																	: 50,
															);
														}}
														className="mt-1 block w-24 border border-black px-2 py-1"
													/>
												</label>
												<label className="flex items-start gap-2 border border-gray-300 bg-white p-2">
													<input
														type="checkbox"
														checked={secMetricSeriesExperimentClearBeforeRun}
														onChange={(event) =>
															setSecMetricSeriesExperimentClearBeforeRun(
																event.target.checked,
															)
														}
													/>
													<span>
														<span className="block font-bold">
															Clear experiment table
														</span>
														<span className="block text-[11px] leading-4 text-gray-600">
															Truncate sec_companyfact_metric_series_experiment
															before this run.
														</span>
													</span>
												</label>
												<button
													type="button"
													onClick={runTagExperiment}
													disabled={activeButtonAction !== null || isTriggering}
													className="border border-black bg-white px-3 py-1 text-xs font-bold disabled:opacity-50"
												>
													{activeButtonAction === "tagExperiment"
														? "Starting..."
														: "Run tag experiment"}
												</button>
											</div>
											<p className="text-[11px] leading-4 text-gray-600">
												Reads enabled tags from tagMetaExperment, selects CIKs
												from candidate stats, restages only that capped target
												set, and writes to sec_companyfact_metric_series_experiment.
											</p>
											{buttonNotice?.action === "tagExperiment" ? (
												<p className="text-[11px] text-gray-600" aria-live="polite">
													{buttonNotice.message}
												</p>
											) : null}
										</div>
									</div>
								</div>
							</div>
							<div className="space-y-2 border-t border-black pt-3">
								<h3 className="font-bold">Prepared Series</h3>
								<p className="text-xs text-gray-600">
									These jobs build reusable input tables before feature rows.
									SEC enriched series prepares SEC-derived inputs; Derived
									metric series uses prepared inputs plus price or macro data.
								</p>
								<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
									{PREPARED_SERIES_JOB_KEYS.map(renderJobCheckbox)}
								</div>
							</div>
							<div className="space-y-2 border-t border-black pt-3">
								<h3 className="font-bold">Expectations</h3>
								<p className="text-xs text-gray-600">
									Scenario outputs that reverse current ticker valuation into
									implied future financial requirements. These jobs use stored
									price history and prepared SEC financial series.
								</p>
								<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
									{EXPECTATION_JOB_KEYS.map(renderJobCheckbox)}
								</div>
							</div>
							<div className="space-y-2 border-t border-black pt-3">
								<h3 className="font-bold">Features</h3>
								<p className="text-xs text-gray-600">
									Axis feature jobs convert prepared source, derived, and
									market data into factor-owned feature rows and comparison
									outputs.
								</p>
								<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
									{FEATURE_JOB_KEYS.map(renderJobCheckbox)}
								</div>
							</div>
							<div className="space-y-2 border-t border-black pt-3">
								<h3 className="font-bold">Signals</h3>
								<p className="text-xs text-gray-600">
									Signal jobs select factor signals from completed feature rows
									and cluster signal activation patterns. These jobs ignore
									Company Scope.
								</p>
								<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
									{SIGNAL_JOB_KEYS.map(renderJobCheckbox)}
								</div>
								<div className="border border-red-800 bg-red-50 p-3 text-xs text-red-900">
									<label className="flex items-start gap-2">
										<input
											type="checkbox"
											checked={signalPercolationClearBeforeRun}
											disabled={!isSignalPercolationSelected}
											onChange={(event) => {
												setSignalPercolationClearBeforeRun(
													event.target.checked,
												);
											}}
										/>
										<span>
											<span className="block font-bold">
												Clear stored timeline before run
											</span>
											<span className="block leading-4">
												When checked, the next normal Run deletes stored signal
												percolation snapshots and forward returns for the
												selected axis lenses before rebuilding. Leave unchecked
												for a normal refresh/upsert run.
											</span>
										</span>
									</label>
								</div>
							</div>
						</div>
					) : null}
				</section>
				<section className="space-y-3 border border-black bg-white p-4">
					<div className="flex items-start justify-between gap-3">
						<h2 className="font-bold">SEC Bulk Ingest State</h2>
						<div className="flex flex-col items-end gap-1">
							<button
								type="button"
								onClick={refreshSecBulkStateFromButton}
								disabled={activeButtonAction !== null}
								className="border border-black bg-white px-3 py-1 text-xs font-bold disabled:opacity-50"
							>
								{activeButtonAction === "secBulk"
									? "Refreshing..."
									: "Refresh bulk state"}
							</button>
							{buttonNotice?.action === "secBulk" ? (
								<p className="text-right text-xs text-gray-600" aria-live="polite">
									{buttonNotice.message}
								</p>
							) : null}
						</div>
					</div>
					{secBulkState ? (
						<div className="grid gap-2 text-sm sm:grid-cols-2">
							<div>Archive: {secBulkState.archive_status}</div>
							<div>Ingest: {secBulkState.ingest_status}</div>
							<div>
								Last processed CIKs:{" "}
								{secBulkState.latest_processed_cik_count ?? "-"}
							</div>
							<div>
								Archive size: {formatFileSizeGb(secBulkState.archive_file_size)}
							</div>
							<div>
								Archive updated:{" "}
								{formatLocalDateTime(secBulkState.archive_mtime_iso)}
							</div>
							<div>
								Last ingest completed:{" "}
								{formatLocalDateTime(secBulkState.ingest_completed_at)}
							</div>
						</div>
					) : (
						<p className="text-sm text-gray-600">No SEC bulk state loaded.</p>
					)}
					{secBulkStateError ? (
						<p className="text-sm text-red-700">{secBulkStateError}</p>
					) : null}
					{secBulkState?.archive_error ? (
						<p className="text-sm text-red-700">
							Archive error: {secBulkState.archive_error}
						</p>
					) : null}
					{secBulkState?.ingest_error ? (
						<p className="text-sm text-red-700">
							Ingest error: {secBulkState.ingest_error}
						</p>
					) : null}
				</section>
				<section className="space-y-3 border border-black bg-white p-4">
					<div className="flex items-start justify-between gap-3">
						<h2 className="font-bold">Database Size</h2>
						<div className="flex flex-col items-end gap-1">
							<button
								type="button"
								onClick={refreshDatabaseSizeFromButton}
								disabled={activeButtonAction !== null}
								className="border border-black bg-white px-3 py-1 text-xs font-bold disabled:opacity-50"
							>
								{activeButtonAction === "dbSize"
									? "Refreshing..."
									: "Refresh DB size"}
							</button>
							{buttonNotice?.action === "dbSize" ? (
								<p className="text-right text-xs text-gray-600" aria-live="polite">
									{buttonNotice.message}
								</p>
							) : null}
						</div>
					</div>
					{databaseSizeReport ? (
						<div className="space-y-3">
							<div className="grid gap-2 text-sm sm:grid-cols-2">
								<div>Database: {databaseSizeReport.database.database_name}</div>
								<div>Total: {databaseSizeReport.database.total_database_size}</div>
							</div>
							<h3 className="mt-4 font-bold">Largest Tables</h3>
							<table className="w-full border-collapse text-xs">
								<thead>
									<tr>
										<th className="border border-black p-1 text-left">Table</th>
										<th className="border border-black p-1 text-right">Table</th>
										<th className="border border-black p-1 text-right">Index</th>
										<th className="border border-black p-1 text-right">Total</th>
										<th className="border border-black p-1 text-right">GB</th>
									</tr>
								</thead>
								<tbody>
									{databaseSizeReport.tables.slice(0, 5).map((row) => (
										<tr key={`${row.schema_name}.${row.table_name}`}>
											<td className="border border-black p-1">{row.table_name}</td>
											<td className="border border-black p-1 text-right">{row.table_size}</td>
											<td className="border border-black p-1 text-right">{row.index_size}</td>
											<td className="border border-black p-1 text-right">{row.total_size}</td>
											<td className="border border-black p-1 text-right">{row.total_size_gb}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					) : (
						<p className="text-sm text-gray-600">
							No database size report loaded.
						</p>
					)}
					{databaseSizeReportError ? (
						<p className="text-sm text-red-700">{databaseSizeReportError}</p>
					) : null}
				</section>
			</div>
		</main>
	);
}
