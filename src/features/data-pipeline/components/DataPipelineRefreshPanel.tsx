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

const SEC_COMPANYFACT_JOB_KEYS: DataPipelineRefreshJobKey[] = [
  "sec_bulk_ingest",
  "fiscal_profile",
  "metric_series",
  "series_validation",
];

const SIGNAL_MACRO_JOB_KEYS: DataPipelineRefreshJobKey[] = [
  "macro_fred_series_sync",
  "factor_metric_features",
  "factor_signals",
];

const GLOBAL_ANALYTICS_JOB_KEYS: DataPipelineRefreshJobKey[] = [
  "factor_metric_clustering",
];

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

export function DataPipelineRefreshPanel() {
  const [secBulkState, setSecBulkState] =
    useState<SecBulkIngestState | null>(null);

  const [selectedJobs, setSelectedJobs] =
    useState<DataPipelineRefreshJobKey[]>([
      ...DATA_PIPELINE_REFRESH_JOB_KEYS,
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
    useState<DataPipelineCompanyScope>("all");
  const [universeRefreshMode, setUniverseRefreshMode] =
    useState<DataPipelineUniverseRefreshMode>("skip");
  const [selectedUniverseKeys, setSelectedUniverseKeys] =
    useState<UniverseKey[]>([...DEFAULT_UNIVERSE_KEYS]);
  const [tickerCoreSyncMode, setTickerCoreSyncMode] =
    useState<DataPipelineTickerCoreSyncMode>("skip");
  const [tickerCoreMaxRequests, setTickerCoreMaxRequests] = useState(200);

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
      const response = await triggerDataPipelineRefresh({
        jobs: selectedJobs,
        rebuild: true,
        rebuildMode,
        companyScope,
        universeRefreshMode,
        universeKeys: selectedUniverseKeys,
        tickerCoreSyncMode,
        tickerCoreMaxRequests,
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
								<span className="font-bold">Current job:</span> {status.currentJob}
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
										{event.job ? <span>[{event.job}] </span> : null}
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
								<div className="grid gap-2 text-sm">
									<label className="block">
										<input
											type="radio"
											name="universeRefreshMode"
											value="skip"
											checked={universeRefreshMode === "skip"}
											onChange={() => setUniverseRefreshMode("skip")}
										/>{" "}
										Use stored memberships
									</label>
									<label className="block">
										<input
											type="radio"
											name="universeRefreshMode"
											value="selected"
											checked={universeRefreshMode === "selected"}
											onChange={() => setUniverseRefreshMode("selected")}
										/>{" "}
										Sync selected universe memberships
									</label>
								</div>
								<div className="ml-4 grid grid-cols-[auto_1fr] gap-x-2 text-sm">
									<CornerDownRight
										className="mt-1 h-4 w-4 text-gray-500"
										aria-hidden="true"
									/>
									<div className="space-y-2 bg-[#f7f7f7] p-2">
										<div className="text-[11px] font-bold uppercase tracking-wide text-gray-600">
											Memberships to sync
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
													{universeKey}
												</label>
											))}
										</div>
									</div>
								</div>
								<p className="text-xs text-gray-600">
									Sync only refreshes selected membership lists. Downstream
									company jobs use all stored active memberships from the
									database. S&amp;P 500 uses FMP constituents; S&amp;P 400,
									S&amp;P 600, and DJIA use ETF holdings files. If stored
									memberships are empty, the pipeline falls back to ticker
									identities.
								</p>
							</div>
							<div className="space-y-2 border-t border-black pt-3">
								<h3 className="font-bold">Company Profile &amp; Classification</h3>
								<div className="grid gap-2 text-sm sm:grid-cols-2">
									<label className="block border border-black bg-white p-2">
										<span className="flex items-start gap-2">
											<input
												type="radio"
												name="tickerCoreSyncMode"
												value="skip"
												checked={tickerCoreSyncMode === "skip"}
												onChange={() => setTickerCoreSyncMode("skip")}
											/>
											<span>
												<span className="block font-bold">
													Use stored company profiles
												</span>
												<span className="block text-xs text-gray-600">
													Read existing profile and classification records from
													the database without calling the provider.
												</span>
											</span>
										</span>
									</label>
									<label className="block border border-black bg-white p-2">
										<span className="flex items-start gap-2">
											<input
												type="radio"
												name="tickerCoreSyncMode"
												value="missing_or_stale"
												checked={tickerCoreSyncMode === "missing_or_stale"}
												onChange={() =>
													setTickerCoreSyncMode("missing_or_stale")
												}
											/>
											<span>
												<span className="block font-bold">
													Sync missing/stale profiles &amp; classifications
												</span>
												<span className="block text-xs text-gray-600">
													Fetch only missing or outdated company profile data,
													then update sector, industry, exchange, country, and
													related classification fields before the pipeline runs.
												</span>
											</span>
										</span>
									</label>
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
								<p className="text-xs text-gray-600">
									Company profiles include ticker identity, company name,
									exchange, sector, industry, country, and related classification
									fields. Free FMP accounts allow 250 calls per day, so the
									default request cap is 200.
								</p>
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
									These jobs build from the SEC companyfacts archive through
									fiscal, tag, metric, and validation outputs.
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
												Applies to SEC bulk ingest, fiscal profile, metric
												series, and series validation.
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
									</div>
								</div>
							</div>
							<div className="space-y-2 border-t border-black pt-3">
								<h3 className="font-bold">Signals / Macro</h3>
								<p className="text-xs text-gray-600">
									Macro FRED sync feeds macro contrasts. Factor metric features
									must run before factor signals because signal selection reads
									completed feature rows.
								</p>
								<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
									{SIGNAL_MACRO_JOB_KEYS.map(renderJobCheckbox)}
								</div>
							</div>
							<div className="space-y-2 border-t border-black pt-3">
								<h3 className="font-bold">Global Analytics</h3>
								<p className="text-xs text-gray-600">
									These jobs ignore Company Scope and run across all available
									metric feature position rows.
								</p>
								<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
									{GLOBAL_ANALYTICS_JOB_KEYS.map(renderJobCheckbox)}
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
