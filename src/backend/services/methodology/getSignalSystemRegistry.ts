import { db } from "@/backend/config/db";

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

type AxisDisplayFile = {
	headlineTitle?: string;
	featureLabels?: Record<string, string>;
};

type FeatureDefinitionRegistryRow = {
	factor: string;
	axis: string;
	metric_key: string;
	metric_label: string | null;
	metric_description: string | null;
	feature_key: string;
	feature_label: string;
	definition_payload: InterpretationFeatureEntry | null;
	axis_display_payload: AxisDisplayFile | null;
	source_table: string | null;
	source_version: string | null;
	source_metric_key: string | null;
	period_type: string | null;
	comparison: boolean;
	macro_contrast: boolean;
	is_vector_eligible: boolean;
	show_in_vector: boolean;
	display_order: number;
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
		vectorEligible: boolean;
		showInVector: boolean;
		definitionClusteringHint: boolean | null;
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

export async function getSignalSystemRegistry(): Promise<SignalRegistryFactor[]> {
	return getSignalSystemRegistryFromDb();
}

async function getSignalSystemRegistryFromDb(): Promise<SignalRegistryFactor[]> {
	const result = await db.query<FeatureDefinitionRegistryRow>(
		`
			SELECT
				f.factor,
				f.axis,
				f.metric_key,
				md.metric_label,
				md.metric_description,
				f.feature_key,
				f.feature_label,
				f.definition_payload,
				ad.display_payload AS axis_display_payload,
				f.source_table,
				f.source_version,
				f.source_metric_key,
				f.period_type,
				f.comparison,
				f.macro_contrast,
				f.is_vector_eligible,
				f.show_in_vector,
				f.display_order
			FROM public.ticker_factor_feature_definitions f
			LEFT JOIN public.ticker_factor_metric_display_definitions md
				ON md.model_key = f.model_key
			 AND md.model_version = f.model_version
			 AND md.factor = f.factor
			 AND md.axis = f.axis
			 AND md.metric_key = f.metric_key
			 AND md.is_active = true
			LEFT JOIN public.ticker_factor_axis_display_definitions ad
				ON ad.model_key = f.model_key
			 AND ad.model_version = f.model_version
			 AND ad.factor = f.factor
			 AND ad.axis = f.axis
			 AND ad.is_active = true
			WHERE f.model_key = 'factor_feature'
				AND f.model_version = 'v0'
				AND f.is_active = true
			ORDER BY
				f.factor ASC,
				f.axis ASC,
				f.metric_key ASC,
				f.display_order ASC,
				f.feature_key ASC
			`,
	);

	if (result.rows.length === 0) return [];

	const factorMap = new Map<string, SignalRegistryFactor>();
	const metricMap = new Map<string, SignalRegistryMetric>();

	for (const row of result.rows) {
		const factorAxisKey = `${row.factor}:${row.axis}`;
		let group = factorMap.get(factorAxisKey);

		if (!group) {
			group = {
				factorKey: row.factor,
				axisKey: row.axis,
				headlineTitle: row.axis_display_payload?.headlineTitle ?? null,
				featureCatalog: [],
				metrics: [],
			};
			factorMap.set(factorAxisKey, group);
		}

		const metricRegistryKey = `${factorAxisKey}:${row.metric_key}`;
		let metric = metricMap.get(metricRegistryKey);

		if (!metric) {
			metric = {
				metricKey: row.metric_key,
				metricLabel: row.metric_label ?? formatMetricLabel(row.metric_key),
				description: row.metric_description,
				features: [],
			};
			metricMap.set(metricRegistryKey, metric);
			group.metrics.push(metric);
		}

		const definition = row.definition_payload ?? {};
		metric.features.push({
			key: row.feature_key,
			label: row.feature_label,
			source: definition.source ?? null,
			seriesTable: definition.series?.table ?? row.source_table,
			seriesVersion: definition.series?.version ?? row.source_version,
			seriesMetricKey:
				definition.series?.metricKey ?? row.source_metric_key ?? row.metric_key,
			seriesPeriodType: definition.series?.periodType ?? row.period_type,
			denominator: definition.denominator ?? null,
			counterpart: definition.counterpart ?? null,
			reference: definition.reference ?? null,
			benchmark: definition.benchmark ?? null,
			method: definition.method ?? null,
			lookback: definition.lookback ?? null,
			skip: definition.skip ?? null,
			window: definition.window ?? null,
			sources: definition.sources ?? null,
			valueType: definition.valueType ?? null,
			comparison: row.comparison,
			macroContrast: row.macro_contrast,
			vectorEligible: row.is_vector_eligible,
			showInVector: row.show_in_vector,
			definitionClusteringHint: definition.clustering ?? null,
		});

		if (!group.featureCatalog.some((feature) => feature.key === row.feature_key)) {
			group.featureCatalog.push({
				key: row.feature_key,
				label: row.feature_label,
			});
		}
	}

	return [...factorMap.values()]
		.map((group) => ({
			...group,
			featureCatalog: group.featureCatalog.sort((a, b) =>
				a.label.localeCompare(b.label),
			),
			metrics: group.metrics.sort((a, b) =>
				a.metricLabel.localeCompare(b.metricLabel),
			),
		}))
		.sort((a, b) =>
			`${a.factorKey}:${a.axisKey}`.localeCompare(`${b.factorKey}:${b.axisKey}`),
		);
}
