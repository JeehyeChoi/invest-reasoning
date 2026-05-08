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

import type { PipelineStatus } from "@/shared/data-pipeline/status";
import type { SecBulkIngestState } from "@/features/data-pipeline/schemas/secBulkIngestState";
import type { DatabaseSizeReport } from "@/features/data-pipeline/schemas/databaseSizeReport";

import { triggerDataPipelineRefresh } from "@/features/data-pipeline/services/triggerDataPipelineRefresh";
import { fetchPipelineStatus } from "@/features/data-pipeline/services/fetchPipelineStatus";
import { fetchSecBulkIngestState } from "@/features/data-pipeline/services/fetchSecBulkIngestState";
import { fetchDatabaseSizeReport } from "@/features/data-pipeline/services/fetchDatabaseSizeReport";

type ButtonAction = "run" | "status" | "secBulk" | "dbSize";
type TickerDailyPriceTargetMode = "universe" | "specific";
type TickerCoreTargetMode = "universe" | "specific";

const SEC_COMPANYFACT_JOB_KEYS: DataPipelineRefreshJobKey[] = [
  "sec_bulk_ingest",
  "series_validation",
];

const ENRICHED_OUTPUT_JOB_KEYS: DataPipelineRefreshJobKey[] = [
  "sec_metric_series_enriched",
  "valuation_metric_series_enriched",
];

const UNIVERSE_MEMBERSHIP_JOB_KEYS: DataPipelineRefreshJobKey[] = [
  "universe_memberships_sync",
];

const COMPANY_PROFILE_JOB_KEYS: DataPipelineRefreshJobKey[] = [
  "ticker_core_sync",
];

const FEATURE_JOB_KEYS: DataPipelineRefreshJobKey[] = [
  "factor_metric_features",
  "market_price_factor_features",
];

const MARKET_DATA_JOB_KEYS: DataPipelineRefreshJobKey[] = [
  "ticker_daily_price_history_sync",
  "macro_fred_series_sync",
];

const SIGNAL_JOB_KEYS: DataPipelineRefreshJobKey[] = [
  "factor_signals",
  "factor_metric_clustering",
];

const DEFAULT_SELECTED_JOB_KEYS = DATA_PIPELINE_REFRESH_JOB_KEYS.filter(
  (job) =>
    job !== "universe_memberships_sync" &&
    job !== "ticker_core_sync" &&
    job !== "macro_fred_series_sync" &&
    job !== "ticker_daily_price_history_sync" &&
    job !== "sec_bulk_ingest" &&
    job !== "metric_series" &&
    job !== "series_validation",
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
  const [hasMounted, setHasMounted] = useState(false);
  const buttonNoticeTimeoutRef = useRef<number | null>(null);
  const shouldPollStatusRef = useRef(false);
  const lastStatusRef = useRef<PipelineStatus["status"]>("idle");

  const isRunning = status.status === "running";
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
  async function runRefresh() {
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
      });

      if (response.status === 409) {
        setStatus({
          status: "running",
          message: "Data pipeline refresh is already running.",
        });
        lastStatusRef.current = "running";
        showButtonNotice("run", "Pipeline refresh is already running.");
        return;
      }

      if (!response.ok) {
        throw new Error("Refresh trigger failed.");
      }

      setStatus({
        status: "running",
        message: "Data pipeline refresh started.",
        startedAt: new Date().toISOString(),
      });
      lastStatusRef.current = "running";
      showButtonNotice("run", "Pipeline refresh started.");
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
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadStatus]);

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
    return (
      <label key={job} className="block bg-[#f5f5f5] p-2 text-sm">
        <span className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={selectedJobs.includes(job)}
            onChange={(event) => {
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
						<div className="flex flex-col gap-1">
							<button
								type="button"
								onClick={runRefresh}
								disabled={
									isTriggering ||
									isRunning ||
									selectedJobs.length === 0 ||
									activeButtonAction !== null
								}
								className="border border-black bg-[#c0c0c0] px-3 py-1 text-xs font-bold disabled:opacity-50"
							>
								{activeButtonAction === "run" || isTriggering
									? "Starting..."
									: isRunning
									? "Running..."
									: "Run pipeline refresh"}
							</button>
							{buttonNotice?.action === "run" ? (
								<p className="text-xs text-gray-600" aria-live="polite">
									{buttonNotice.message}
								</p>
							) : null}
						</div>
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
									memberships sync first.
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
												validation, and enriched outputs. Fiscal
												profile and tag extraction are internal SEC bulk ingest
												steps because they require temporary raw rows.
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
															run the selected SEC jobs across the full mapped set.
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
															the selected SEC jobs for that changed set.
														</span>
													</span>
												</span>
											</label>
										</div>
										<div className="border-t border-gray-300 pt-2 text-[11px] leading-4 text-gray-600">
											A no-change bulk skip produces an empty changed-company
											scope. Use All SEC companies for full rebuilds after logic
											changes.
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
									</div>
								</div>
							</div>
							<div className="space-y-2 border-t border-black pt-3">
								<h3 className="font-bold">Enriched Outputs</h3>
								<p className="text-xs text-gray-600">
									These jobs read cleaned series and build enriched input
									tables. Feature rows are calculated later in Features.
								</p>
								<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
									{ENRICHED_OUTPUT_JOB_KEYS.map(renderJobCheckbox)}
								</div>
							</div>
							<div className="space-y-2 border-t border-black pt-3">
								<h3 className="font-bold">Features</h3>
								<p className="text-xs text-gray-600">
									Feature jobs convert prepared SEC, valuation, and market data
									into factor-owned feature rows and comparison outputs.
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
