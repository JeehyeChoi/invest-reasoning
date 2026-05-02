import { getMetricSystemRegistry } from "@/backend/services/methodology/getMetricSystemRegistry";
import { WhatThisSystemDoes } from "@/features/methodology/sections/01-WhatThisSystemDoes";
import { DataSourcesAndLineage } from "@/features/methodology/sections/02-DataSourcesAndLineage";
import { SECDataProcessing } from "@/features/methodology/sections/03-SECDataProcessing";
import { InternalStructure } from "@/features/methodology/sections/04-InternalStructure";
import { MetricSystem } from "@/features/methodology/sections/05-MetricSystem";
import { ScoringSystem } from "@/features/methodology/sections/06-ScoringSystem";
import { ConfidenceAndWarnings } from "@/features/methodology/sections/07-ConfidenceAndWarnings";
import { InterpretationModel } from "@/features/methodology/sections/08-InterpretationModel";
import { Validation } from "@/features/methodology/sections/09-Validation";
import { Limitations } from "@/features/methodology/sections/10-Limitations";
import { Coverage } from "@/features/methodology/sections/11-Coverage";
import { FileMap } from "@/features/methodology/sections/12-FileMap";

export default async function MethodologyPage() {
	const metricSystem = await getMetricSystemRegistry();
	const { factors, axes } = metricSystem;

	return (
		<main className="min-h-screen bg-[linear-gradient(180deg,#f7f4ed_0%,#f3efe7_42%,#ffffff_100%)]">
			<div className="mx-auto max-w-5xl space-y-5 px-4 py-8 md:px-6 md:py-10">
				<section className="rounded-[1.75rem] border border-stone-200 bg-stone-950 px-6 py-7 text-stone-50 shadow-xl shadow-stone-300/40 md:px-8 md:py-9">
					<div className="text-xs font-semibold uppercase tracking-[0.26em] text-stone-300">
						Methodology
					</div>
					<h1 className="mt-4 max-w-4xl text-3xl font-semibold tracking-tight md:text-4xl">
						A developer-facing explanation of how SEC data becomes metrics,
						signals, and interpretations.
					</h1>
					<p className="mt-4 max-w-3xl text-sm leading-7 text-stone-300 md:text-base">
						This page is for readers who want to inspect the system logic:
						what gets selected, how period ambiguity is resolved, where
						fallbacks enter, how scores relate to metrics, and why
						interpretations should be read as evidence-based hypotheses rather
						than final truth.
					</p>
					<div className="mt-6 grid gap-3 sm:grid-cols-2">
						<div className="rounded-2xl border border-white/10 bg-white/5 p-4">
							<div className="text-2xl font-semibold text-white">{factors.length}</div>
							<div className="mt-1 text-sm text-stone-300">active factors</div>
						</div>
						<div className="rounded-2xl border border-white/10 bg-white/5 p-4">
							<div className="text-2xl font-semibold text-white">{axes.length}</div>
							<div className="mt-1 text-sm text-stone-300">active axes</div>
						</div>
					</div>
				</section>

				<WhatThisSystemDoes />
				<DataSourcesAndLineage />
				<SECDataProcessing />
				<InternalStructure />
				<MetricSystem data={metricSystem} />
				<ScoringSystem />
				<ConfidenceAndWarnings />
				<InterpretationModel />
				<Validation />
				<Limitations />
				<Coverage />
				<FileMap />
			</div>
		</main>
	);
}
