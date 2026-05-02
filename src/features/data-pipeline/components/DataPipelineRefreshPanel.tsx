"use client";

import { useEffect, useRef, useState } from "react";
import {
  DATA_PIPELINE_REFRESH_JOB_KEYS,
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
  const [buttonNotice, setButtonNotice] = useState("");
  const [hasMounted, setHasMounted] = useState(false);
  const buttonNoticeTimeoutRef = useRef<number | null>(null);
  const shouldPollStatusRef = useRef(false);

  const isRunning = status.status === "running";
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
  shouldPollStatusRef.current = isRunning || isSecBulkActive || isTriggering;

  function showButtonNotice(message: string) {
    setButtonNotice(message);

    if (buttonNoticeTimeoutRef.current !== null) {
      window.clearTimeout(buttonNoticeTimeoutRef.current);
    }

    buttonNoticeTimeoutRef.current = window.setTimeout(() => {
      setButtonNotice("");
      buttonNoticeTimeoutRef.current = null;
    }, 3000);
  }

  async function loadStatus() {
    try {
      const data = await fetchPipelineStatus();
      setStatus(data);
    } catch {
      setStatus({
        status: "failed",
        error: "Failed to load pipeline status.",
      });
    }
  }

  async function loadSecBulkState() {
    try {
      const data = await fetchSecBulkIngestState();
      setSecBulkState(data);
      setSecBulkStateError(null);
    } catch {
      setSecBulkStateError("Failed to load SEC bulk state.");
    }
  }

  async function loadDatabaseSizeReport() {
    try {
      const data = await fetchDatabaseSizeReport();
      setDatabaseSizeReport(data);
      setDatabaseSizeReportError(null);
    } catch {
      setDatabaseSizeReportError("Failed to load database size report.");
    }
  }
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
        showButtonNotice("Pipeline refresh is already running.");
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
      showButtonNotice("Pipeline refresh started.");
    } catch {
      setStatus({
        status: "failed",
        error: "Failed to trigger pipeline refresh.",
      });
      showButtonNotice("Failed to trigger pipeline refresh.");
    } finally {
      setIsTriggering(false);
      setActiveButtonAction(null);
    }
  }

  async function refreshStatusFromButton() {
    setActiveButtonAction("status");
    await loadStatus();
    showButtonNotice("Status refreshed.");
    setActiveButtonAction(null);
  }

  async function refreshSecBulkStateFromButton() {
    setActiveButtonAction("secBulk");
    await loadSecBulkState();
    showButtonNotice("SEC bulk state refreshed.");
    setActiveButtonAction(null);
  }

  async function refreshDatabaseSizeFromButton() {
    setActiveButtonAction("dbSize");
    await loadDatabaseSizeReport();
    showButtonNotice("Database size refreshed.");
    setActiveButtonAction(null);
  }

  useEffect(() => {
    setHasMounted(true);
    void loadStatus();
    void loadSecBulkState();
    void loadDatabaseSizeReport();
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (!shouldPollStatusRef.current) return;

      void loadStatus();
      void loadSecBulkState();
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (buttonNoticeTimeoutRef.current !== null) {
        window.clearTimeout(buttonNoticeTimeoutRef.current);
      }
    };
  }, []);

	return (
		<main className="mx-auto max-w-6xl space-y-6 p-6">
			<section className="border border-black bg-white p-4">
				<h1 className="text-xl font-bold">Startup / Data Pipeline</h1>
				<p className="mt-2 text-sm text-gray-700">
					Manually trigger and monitor the data pipeline refresh workflow.
				</p>
			</section>
			<div className="grid gap-6 lg:grid-cols-2">
				<section className="space-y-3 border border-black bg-[#f5f5f5] p-4 lg:col-span-2">
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
						<div className="max-h-36 overflow-auto border border-black bg-white p-2 text-xs">
							<h3 className="mb-2 font-bold">Recent Progress</h3>
							<ul className="space-y-1">
								{[...status.events].reverse().slice(0, 8).map((event) => (
									<li key={`${event.timestamp}-${event.message}`}>
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
				</section>
				<section className="space-y-2 border border-black bg-white p-4 lg:col-span-2">
					<h2 className="font-bold">Jobs</h2>
					<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
						{DATA_PIPELINE_REFRESH_JOB_KEYS.map((job) => (
							<label key={job} className="block text-sm">
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
								/>{" "}
								{job}
							</label>
						))}
					</div>
					{hasMounted ? (
						<div className="space-y-2 border-t border-black pt-3">
							<h3 className="font-bold">Company Scope</h3>
							<div className="grid gap-2 text-sm sm:grid-cols-2">
								<label className="block">
									<input
										type="radio"
										name="companyScope"
										value="all"
										checked={companyScope === "all"}
										onChange={() => setCompanyScope("all")}
									/>{" "}
									All companies
								</label>
								<label className="block">
									<input
										type="radio"
										name="companyScope"
										value="bulk_changed"
										checked={companyScope === "bulk_changed"}
										onChange={() => setCompanyScope("bulk_changed")}
									/>{" "}
									Changed companies from latest SEC bulk ingest
								</label>
							</div>
							<p className="text-xs text-gray-600">
								Changed-company scope applies to fiscal, tag, metric,
								validation, and signal jobs. If SEC bulk ingest is selected, it
								uses companies changed in this refresh; otherwise it uses the
								latest SEC bulk ingest state window. A no-change bulk skip
								produces an empty changed-company scope.
							</p>
							<div className="space-y-2 border-t border-black pt-3">
								<h3 className="font-bold">Universe Refresh</h3>
								<div className="grid gap-2 text-sm sm:grid-cols-2">
									<label className="block">
										<input
											type="radio"
											name="universeRefreshMode"
											value="skip"
											checked={universeRefreshMode === "skip"}
											onChange={() => setUniverseRefreshMode("skip")}
										/>{" "}
										Do not refresh universe
									</label>
									<label className="block">
										<input
											type="radio"
											name="universeRefreshMode"
											value="selected"
											checked={universeRefreshMode === "selected"}
											onChange={() => setUniverseRefreshMode("selected")}
										/>{" "}
										Refresh selected universes
									</label>
								</div>
								<div className="grid gap-2 text-sm sm:grid-cols-3">
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
								<p className="text-xs text-gray-600">
									Default is no universe refresh. Selected universe memberships
									are always loaded from the database; refresh currently syncs
									S&amp;P 500 and leaves other selected universes as stored
									memberships until their sync jobs are added.
								</p>
							</div>
							<div className="space-y-2 border-t border-black pt-3">
								<h3 className="font-bold">Ticker Core Sync</h3>
								<div className="grid gap-2 text-sm sm:grid-cols-2">
									<label className="block">
										<input
											type="radio"
											name="tickerCoreSyncMode"
											value="skip"
											checked={tickerCoreSyncMode === "skip"}
											onChange={() => setTickerCoreSyncMode("skip")}
										/>{" "}
										Do not sync ticker core data
									</label>
									<label className="block">
										<input
											type="radio"
											name="tickerCoreSyncMode"
											value="missing_or_stale"
											checked={tickerCoreSyncMode === "missing_or_stale"}
											onChange={() =>
												setTickerCoreSyncMode("missing_or_stale")
											}
										/>{" "}
										Sync missing/stale ticker core data
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
									Default is no ticker core sync. Free FMP accounts allow 250
									calls per day, so the default request cap is 200.
								</p>
							</div>
						</div>
					) : null}
				</section>
				<section className="flex flex-wrap gap-2 border border-black bg-white p-4 lg:col-span-2">
					<button
						type="button"
						onClick={runRefresh}
						disabled={
							isTriggering ||
							isRunning ||
							selectedJobs.length === 0 ||
							activeButtonAction !== null
						}
						className="border border-black bg-[#c0c0c0] px-4 py-2 text-sm font-bold disabled:opacity-50"
					>
						{activeButtonAction === "run" || isTriggering
							? "Starting..."
							: isRunning
							? "Running..."
							: "Run pipeline refresh"}
					</button>
					<button
						type="button"
						onClick={refreshStatusFromButton}
						disabled={activeButtonAction !== null}
						className="border border-black bg-white px-4 py-2 text-sm font-bold disabled:opacity-50"
					>
						{activeButtonAction === "status" ? "Refreshing..." : "Refresh status"}
					</button>
					{buttonNotice ? (
						<p className="basis-full text-xs text-gray-600" aria-live="polite">
							{buttonNotice}
						</p>
					) : null}
				</section>
				<section className="space-y-3 border border-black bg-white p-4 lg:col-span-2">
					<div className="flex items-start justify-between gap-3">
						<h2 className="font-bold">SEC Bulk Ingest State</h2>
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
					</div>
					{secBulkState ? (
						<div className="grid grid-cols-2 gap-2 text-sm">
							<div>Archive status: {secBulkState.archive_status}</div>
							<div>Ingest status: {secBulkState.ingest_status}</div>
							<div>Archive size: {secBulkState.archive_file_size ?? "-"}</div>
							<div>
								Checked at: {formatLocalDateTime(secBulkState.archive_checked_at)}
							</div>
							<div>
								Started at: {formatLocalDateTime(secBulkState.ingest_started_at)}
							</div>
							<div>
								Completed at:{" "}
								{formatLocalDateTime(secBulkState.ingest_completed_at)}
							</div>
							<div>Updated at: {formatLocalDateTime(secBulkState.updated_at)}</div>
							<div>Dataset: {secBulkState.dataset}</div>
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
				<section className="space-y-3 border border-black bg-white p-4 lg:col-span-2">
					<div className="flex items-start justify-between gap-3">
						<h2 className="font-bold">Database Size</h2>
						<button
							type="button"
							onClick={refreshDatabaseSizeFromButton}
							disabled={activeButtonAction !== null}
							className="border border-black bg-white px-3 py-1 text-xs font-bold disabled:opacity-50"
						>
							{activeButtonAction === "dbSize" ? "Refreshing..." : "Refresh DB size"}
						</button>
					</div>
					{databaseSizeReport ? (
						<div className="space-y-3">
							<div className="grid gap-2 text-sm sm:grid-cols-2">
								<div>Database: {databaseSizeReport.database.database_name}</div>
								<div>Total: {databaseSizeReport.database.total_database_size}</div>
								<div>Total GB: {databaseSizeReport.database.total_database_gb}</div>
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
