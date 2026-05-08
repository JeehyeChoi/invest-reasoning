import path from "node:path";
import { promises as fs } from "node:fs";
import { FACTOR_BLUEPRINTS } from "@/backend/config/factors/blueprints";

type InterpretationFeatureEntry = {
	source?: string;
	series?: {
		table?: string;
		version?: string;
		metricKey?: string;
		periodType?: string;
	};
	denominator?: {
		table?: string;
		version?: string;
		metricKey?: string;
		periodType?: string;
		source?: string;
	};
	counterpart?: {
		table?: string;
		version?: string;
		metricKey?: string;
		periodType?: string;
		source?: string;
	};
	sources?: Record<string, string>;
	reference?: string;
	benchmark?: string;
	lookback?: number;
	skip?: number;
	window?: number;
	method?: string;
	valueType?: string;
	comparison?: boolean;
	macroContrast?: boolean;
	clustering?: boolean;
};

type InterpretationFile = {
	factor: string;
	axis: string;
	metricKey: string;
	features: Record<string, InterpretationFeatureEntry>;
	meta?: {
		description?: string;
	};
};

type AxisDisplayFile = {
	headlineTitle?: string;
	featureLabels?: Record<string, string>;
};

export type SignalRegistryMetric = {
	metricKey: string;
	metricLabel: string;
	description: string | null;
	features: Array<{
		key: string;
		label: string;
		source: string | null;
		seriesTable: string | null;
		seriesVersion: string | null;
		seriesMetricKey: string | null;
		seriesPeriodType: string | null;
		denominator: InterpretationFeatureEntry["denominator"] | null;
		counterpart: InterpretationFeatureEntry["counterpart"] | null;
		reference: string | null;
		benchmark: string | null;
		method: string | null;
		lookback: number | null;
		skip: number | null;
		window: number | null;
		sources: Record<string, string> | null;
		valueType: string | null;
		comparison: boolean;
		macroContrast: boolean;
		clustering: boolean;
	}>;
};

export type SignalRegistryFactor = {
	factorKey: string;
	axisKey: string;
	headlineTitle: string | null;
	featureCatalog: Array<{
		key: string;
		label: string;
	}>;
	metrics: SignalRegistryMetric[];
};

function formatMetricLabel(metricKey: string): string {
	if (metricKey === "capex_cash") return "Cash CapEx";
	if (metricKey === "capex_incurred") return "Incurred CapEx";
	if (metricKey === "gross_profit") return "Gross Profit";
	if (metricKey === "operating_income") return "Operating Income";
	if (metricKey === "operating_cash_flow") return "Operating Cash Flow";
	if (metricKey === "net_income") return "Net Income";
	if (metricKey === "revenue") return "Revenue";

	return metricKey
		.split("_")
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

async function readJson<T>(filePath: string): Promise<T> {
	const raw = await fs.readFile(filePath, "utf-8");
	return JSON.parse(raw) as T;
}

export async function getSignalSystemRegistry(): Promise<SignalRegistryFactor[]> {
	const rootDir = path.join(
		process.cwd(),
		"src",
		"backend",
		"config",
		"factors",
	);

	const factorEntries = await fs.readdir(rootDir, { withFileTypes: true });
	const results: SignalRegistryFactor[] = [];

	for (const factorEntry of factorEntries) {
		if (!factorEntry.isDirectory()) continue;

		const factorDir = path.join(rootDir, factorEntry.name);
		const axisEntries = await fs.readdir(factorDir, { withFileTypes: true });

		for (const axisEntry of axisEntries) {
			if (!axisEntry.isDirectory()) continue;

			const axisDir = path.join(factorDir, axisEntry.name);
			const displayCommonPath = path.join(axisDir, "display.common.json");
			let axisDisplay: AxisDisplayFile | null = null;

			try {
				axisDisplay = await readJson<AxisDisplayFile>(displayCommonPath);
			} catch {
				axisDisplay = null;
			}

			const metricEntries = await fs.readdir(axisDir, { withFileTypes: true });
			const metrics: SignalRegistryMetric[] = [];

			for (const metricEntry of metricEntries) {
				if (!metricEntry.isDirectory()) continue;

				const interpretationPath = path.join(
					axisDir,
					metricEntry.name,
					"interpretation.json",
				);

				try {
					const interpretation =
						await readJson<InterpretationFile>(interpretationPath);

					const features = Object.entries(interpretation.features)
						.map(([featureKey, config]) => ({
							key: featureKey,
							label: axisDisplay?.featureLabels?.[featureKey] ?? featureKey,
							source: config.source ?? null,
							seriesTable: config.series?.table ?? null,
							seriesVersion: config.series?.version ?? null,
							seriesMetricKey: config.series?.metricKey ?? interpretation.metricKey,
							seriesPeriodType: config.series?.periodType ?? null,
							denominator: config.denominator ?? null,
							counterpart: config.counterpart ?? null,
							reference: config.reference ?? null,
							benchmark: config.benchmark ?? null,
							method: config.method ?? null,
							lookback: config.lookback ?? null,
							skip: config.skip ?? null,
							window: config.window ?? null,
							sources: config.sources ?? null,
							valueType: config.valueType ?? null,
							comparison: config.comparison ?? false,
							macroContrast: config.macroContrast ?? false,
							clustering: config.clustering ?? false,
						}));

					metrics.push({
						metricKey: interpretation.metricKey,
						metricLabel: formatMetricLabel(interpretation.metricKey),
						description: interpretation.meta?.description ?? null,
						features,
					});
				} catch {
					continue;
				}
			}

			if (metrics.length === 0) continue;

			const featureMap = new Map<string, string>();
			for (const metric of metrics) {
				for (const feature of metric.features) {
					featureMap.set(feature.key, feature.label);
				}
			}

			results.push({
				factorKey: factorEntry.name,
				axisKey: axisEntry.name,
				headlineTitle: axisDisplay?.headlineTitle ?? null,
				featureCatalog: [...featureMap.entries()].map(([key, label]) => ({
					key,
					label,
				})),
				metrics: metrics.sort((a, b) => a.metricLabel.localeCompare(b.metricLabel)),
			});
		}
	}

	const existingScopes = new Set(
		results.map((group) => `${group.factorKey}:${group.axisKey}`),
	);

	for (const [factorKey, factorBlueprint] of Object.entries(FACTOR_BLUEPRINTS)) {
		if (!factorBlueprint) continue;

		for (const axisKey of Object.keys(factorBlueprint)) {
			const scopeKey = `${factorKey}:${axisKey}`;
			if (existingScopes.has(scopeKey)) continue;

			results.push({
				factorKey,
				axisKey,
				headlineTitle: null,
				featureCatalog: [],
				metrics: [],
			});
		}
	}

	return results.sort((a, b) =>
		`${a.factorKey}:${a.axisKey}`.localeCompare(`${b.factorKey}:${b.axisKey}`),
	);
}
