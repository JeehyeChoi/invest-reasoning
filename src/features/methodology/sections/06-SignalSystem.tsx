import { MethodologySection } from "@/features/methodology/components/MethodologySection";
import type { SignalRegistryFactor } from "@/backend/services/methodology/getSignalSystemRegistry";

type SignalSystemProps = {
	signalSystem: SignalRegistryFactor[];
};

export function SignalSystem({ signalSystem }: SignalSystemProps) {
	const sampleSignals =
		signalSystem.find(
			(item) => item.factorKey === "quality" && item.axisKey === "fundamentals_based",
		) ?? signalSystem[0] ?? null;

	return (
		<MethodologySection eyebrow="06" title="Signal System">
			<p className="text-sm leading-7 text-stone-700">
				The live system is organized as metric series, factor-owned metric
				features, and factor signal selection. Narrative commentary is deferred
				until the signal definitions are stable.
			</p>

			<div className="mt-5 grid gap-4 lg:grid-cols-2">
				<div className="border border-zinc-200 bg-[#fbfaf5] p-4">
					<div className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">
						Interpretation layer
					</div>
					<p className="mt-2 text-sm leading-6 text-zinc-600">
						`interpretation.json` defines which factor-owned features are active
						for a metric, and each feature names the exact series it reads:
						table, metric key, period type, source column, and optional reference.
					</p>
					{sampleSignals ? (
						<div className="mt-3 border border-zinc-200 bg-white p-3">
							<div className="font-medium text-zinc-950">
								Example: {sampleSignals.headlineTitle ?? sampleSignals.factorKey}
							</div>
							<ul className="mt-2 list-disc pl-5 text-sm leading-6 text-zinc-700">
								{sampleSignals.metrics[0]?.features.map((feature) => (
									<li key={feature.key}>
										{feature.label}
										{feature.seriesMetricKey
											? ` reads ${feature.seriesMetricKey}/${feature.seriesPeriodType ?? "period"}`
											: ""}
										{feature.source ? ` uses ${feature.source}` : ""}
										{feature.method ? ` via ${feature.method}` : ""}
										{feature.reference ? ` against ${feature.reference}` : ""}
										{feature.benchmark ? ` versus ${feature.benchmark}` : ""}
										{feature.lookback ? ` over ${feature.lookback} periods` : ""}
										{feature.skip ? ` skipping ${feature.skip} periods` : ""}
										{feature.window ? ` across ${feature.window} periods` : ""}
										{feature.sources
											? ` from ${Object.values(feature.sources).join(", ")}`
											: ""}
									</li>
								))}
							</ul>
						</div>
					) : null}
				</div>

				<div className="border border-zinc-200 bg-[#fbfaf5] p-4">
					<div className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">
						Factor signal rules
					</div>
					<ul className="mt-2 list-disc pl-5 text-sm leading-6 text-zinc-700">
						<li>Signal definitions select one factor signal from factor-owned metric features.</li>
						<li>`interpretation.json` remains the source of truth for which metric features exist.</li>
						<li>Signal definitions look at feature keys, not hard-coded metric lists.</li>
						<li>Evidence stored on signal rows is a copied record of the feature rows that supported the selected signal.</li>
						<li>Benchmark comparisons and macro contrasts are contextual layers, not part of the internal signal selection model.</li>
					</ul>
				</div>
			</div>

			<div className="mt-4 grid gap-4 lg:grid-cols-2">
				<div className="border border-zinc-200 bg-white p-4">
					<div className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">
						Signal thresholds
					</div>
					<ul className="mt-2 list-disc pl-5 text-sm leading-6 text-zinc-700">
						<li>Growth currently uses latest growth, durable growth, acceleration, and selected turnaround momentum features.</li>
						<li>Signal thresholds belong to `ticker_factor_signal_definitions`, not commentary code.</li>
						<li>Confidence is derived from observed feature coverage and supporting evidence count.</li>
						<li>Future commentary should follow stored signal evidence rather than inventing explanations.</li>
					</ul>
				</div>

				<div className="border border-zinc-200 bg-white p-4">
					<div className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">
						Why commentary is deferred
					</div>
					<p className="mt-2 text-sm leading-6 text-zinc-600">
						The current frontend receives selected signal values, confidence,
						observed metric counts, and supporting evidence. It does not receive
						authored commentary text.
					</p>
					<p className="mt-3 text-sm leading-6 text-zinc-600">
						Benchmark comparisons and macro contrasts can be added later as
						contextual inputs to separate signal definitions, but they are not
						part of the internal feature-only signal selection path.
					</p>
				</div>
			</div>
		</MethodologySection>
	);
}
