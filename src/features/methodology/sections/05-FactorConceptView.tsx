import { MethodologySection } from "@/features/methodology/components/MethodologySection";
import type { SignalRegistryFactor } from "@/backend/services/methodology/getSignalSystemRegistry";
import { CornerDownRight } from "lucide-react";

type FactorConceptViewProps = {
	data: {
		factors: Array<{ factor_key: string; factor_name?: string | null }>;
		metrics: unknown[];
		methods: unknown[];
	};
	signalSystem: SignalRegistryFactor[];
};

function getFactorColor(factorKey: string): string {
	const palette: Record<string, string> = {
		growth: "#173b35",
		quality: "#8a4b24",
		capex_cycle: "#0f766e",
		income: "#7c3aed",
		defensive: "#b45309",
		consumer_linked: "#2563eb",
		rate_sensitive: "#be185d",
		energy_linked: "#15803d",
		china_exposure: "#c2410c",
		size: "#1d4ed8",
		momentum: "#4338ca",
		high_beta: "#dc2626",
		low_volatility: "#0891b2",
		duration_sensitive: "#7c2d12",
		liquidity_sensitive: "#0369a1",
		inflation_hedge: "#9a3412",
		commodity_linked: "#65a30d",
		reshoring_defense: "#374151",
		value: "#4f46e5",
		cyclical: "#ea580c",
	};

	return palette[factorKey] ?? "#52525b";
}

function summarizeValues(values: Array<string | null | undefined>, fallback: string) {
	const uniqueValues = [...new Set(values.filter(Boolean))] as string[];

	if (uniqueValues.length === 0) return fallback;
	if (uniqueValues.length === 1) return uniqueValues[0];
	return uniqueValues.join(" / ");
}

function buildConceptNodes(
	signalSystem: SignalRegistryFactor[],
	factors: FactorConceptViewProps["data"]["factors"],
) {
	return signalSystem.map((group) => {
		const factor = factors.find((item) => item.factor_key === group.factorKey);
		const signalMeta = new Map<
			string,
			{
				sourceMetrics: Array<string | null>;
				periodTypes: Array<string | null>;
				sources: Array<string | null>;
				methods: Array<string | null>;
			}
		>();

		for (const metric of group.metrics) {
			for (const feature of metric.features) {
				const meta = signalMeta.get(feature.key) ?? {
					sourceMetrics: [],
					periodTypes: [],
					sources: [],
					methods: [],
				};
				meta.sourceMetrics.push(feature.seriesMetricKey);
				meta.periodTypes.push(feature.seriesPeriodType);
				meta.sources.push(feature.source);
				meta.methods.push(feature.method);
				signalMeta.set(feature.key, meta);
			}
		}

		return {
			id: `${group.factorKey}:${group.axisKey}`,
			label: factor?.factor_name ?? group.headlineTitle ?? group.factorKey,
			color: getFactorColor(group.factorKey),
			features: group.featureCatalog.map((feature) => {
				const meta = signalMeta.get(feature.key);
				return {
					...feature,
					sourceMetricSummary: summarizeValues(meta?.sourceMetrics ?? [], "metric"),
					periodSummary: summarizeValues(meta?.periodTypes ?? [], "period"),
					sourceSummary: summarizeValues(meta?.sources ?? [], "direct"),
					methodSummary: summarizeValues(meta?.methods ?? [], "none"),
				};
			}),
		};
	});
}

export function FactorConceptView({
	data,
	signalSystem,
}: FactorConceptViewProps) {
	const { factors } = data;
	const conceptNodes = buildConceptNodes(signalSystem, factors);

	return (
		<MethodologySection eyebrow="05" title="Factor Concept View">
			<section className="mt-1 border border-zinc-200 bg-[#fbfaf5] p-4">
				<div className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">
					Factor -&gt; signal
				</div>
				<p className="mt-2 text-sm leading-6 text-zinc-600">
					What each factor is made of.
				</p>

				<div className="mt-4 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
					{conceptNodes.map((node) => (
						<article
							key={node.id}
							className="min-w-0 border border-zinc-200 bg-white p-4"
						>
							<div
								className="inline-flex rounded-full px-3 py-1 text-sm font-semibold text-white"
								style={{ backgroundColor: node.color }}
							>
								{node.label}
							</div>

							<div className="mt-4 grid gap-2">
								{node.features.map((feature) => (
									<div
										key={`${node.id}:${feature.key}`}
										className="min-w-0 flex items-start gap-3 rounded border border-zinc-200 bg-[#f8f8f5] px-3 py-2"
									>
										<CornerDownRight
											size={16}
											className="mt-0.5 shrink-0"
											style={{ color: node.color }}
										/>
										<div className="min-w-0">
											<div className="break-words text-sm font-medium text-zinc-800">
												{feature.label}
											</div>
											<div className="break-all font-mono text-[11px] leading-4 text-zinc-500">
												{feature.key}
											</div>
											<div className="mt-2 grid gap-1 font-mono text-[11px] leading-4 text-zinc-600">
												<div className="min-w-0 break-all">
													series={feature.sourceMetricSummary}:{feature.periodSummary}
												</div>
												<div className="min-w-0 break-all">
													column={feature.sourceSummary}
												</div>
												<div className="min-w-0 break-all">
													method={feature.methodSummary}
												</div>
											</div>
										</div>
									</div>
								))}
							</div>
						</article>
					))}
				</div>
			</section>
		</MethodologySection>
	);
}
