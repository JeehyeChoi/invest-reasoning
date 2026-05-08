import { getMetricSystemRegistry } from "@/backend/services/methodology/getMetricSystemRegistry";
import { getSignalSystemRegistry } from "@/backend/services/methodology/getSignalSystemRegistry";
import { WhatThisSystemDoes } from "@/features/methodology/sections/01-WhatThisSystemDoes";
import { DataSourcesAndLineage } from "@/features/methodology/sections/02-DataSourcesAndLineage";
import { SECDataProcessing } from "@/features/methodology/sections/03-SECDataProcessing";
import { InternalStructure } from "@/features/methodology/sections/04-InternalStructure";
import { FactorConceptView } from "@/features/methodology/sections/05-FactorConceptView";
import { SignalSystem } from "@/features/methodology/sections/06-SignalSystem";
import { ConfidenceAndWarnings } from "@/features/methodology/sections/07-ConfidenceAndWarnings";
import { InterpretationModel } from "@/features/methodology/sections/08-InterpretationModel";
import { Validation } from "@/features/methodology/sections/09-Validation";
import { Limitations } from "@/features/methodology/sections/10-Limitations";
import { Coverage } from "@/features/methodology/sections/11-Coverage";
import { FileMap } from "@/features/methodology/sections/12-FileMap";
import {
	WorkstationFrame,
	WorkstationPanel,
} from "@/features/workstation/components/WorkstationChrome";

export default async function MethodologyPage() {
	const [metricSystem, signalSystem] = await Promise.all([
		getMetricSystemRegistry(),
		getSignalSystemRegistry(),
	]);
	const { factors, axes } = metricSystem;

	return (
		<WorkstationFrame
			title="methodology workstation"
			backHref="/dashboard"
			backLabel="Dashboard"
			maxWidthClassName="max-w-7xl"
		>
			<div className="space-y-5">
				<section className="border-b border-zinc-300 pb-7">
					<div className="font-mono text-xs font-semibold uppercase tracking-[0.24em] text-[#6d5a2d]">
						Methodology
					</div>
					<div className="mt-3 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
						<div className="min-w-0 flex-1">
							<h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-zinc-950 md:text-4xl">
								How SEC data becomes metrics, signals, and interpretations
							</h1>
							<p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
								This page documents the logic behind the system for readers who
								care about tag selection, period resolution, metric
								construction, signal context, and interpretation boundaries.
							</p>
						</div>

						<div className="grid w-full grid-cols-2 border border-zinc-950 bg-white text-right shadow-[4px_4px_0_0_rgba(24,24,27,0.12)] sm:w-auto sm:min-w-[280px] lg:flex-none">
							<div className="border-r border-zinc-200 px-3 py-3">
								<div className="text-2xl font-semibold text-zinc-950">
									{factors.length}
								</div>
								<div className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500">
									factors
								</div>
							</div>
							<div className="px-3 py-3">
								<div className="text-2xl font-semibold text-zinc-950">
									{axes.length}
								</div>
								<div className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500">
									axes
								</div>
							</div>
						</div>
					</div>
				</section>

				<WorkstationPanel>
					<div className="grid gap-0 text-sm md:grid-cols-2 xl:grid-cols-4">
						<div className="border-b border-zinc-200 p-4 md:border-r xl:border-b-0">
							<div className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">
								source
							</div>
							<div className="mt-1 font-medium text-zinc-950">
								SEC companyfacts
							</div>
						</div>
						<div className="border-b border-zinc-200 p-4 xl:border-r xl:border-b-0">
							<div className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">
								question
							</div>
							<div className="mt-1 font-medium text-zinc-950">
								how data is chosen and transformed
							</div>
						</div>
						<div className="border-b border-zinc-200 p-4 md:border-r md:border-b-0">
							<div className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">
								audience
							</div>
							<div className="mt-1 font-medium text-zinc-950">
								developers and heavy users
							</div>
						</div>
						<div className="p-4">
							<div className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">
								output
							</div>
							<div className="mt-1 font-medium text-zinc-950">
								traceable interpretation
							</div>
						</div>
					</div>
				</WorkstationPanel>

				<WhatThisSystemDoes />
				<DataSourcesAndLineage />
				<SECDataProcessing />
				<InternalStructure />
				<FactorConceptView data={metricSystem} signalSystem={signalSystem} />
				<SignalSystem signalSystem={signalSystem} />
				<ConfidenceAndWarnings />
				<InterpretationModel />
				<Validation />
				<Limitations />
				<Coverage />
				<FileMap />
			</div>
		</WorkstationFrame>
	);
}
