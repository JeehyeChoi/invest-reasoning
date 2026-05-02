import { MethodologySection } from "@/features/methodology/components/MethodologySection";

export function DataSourcesAndLineage() {
	return (
		<MethodologySection eyebrow="02" title="Data Sources & Lineage">
			<ul className="list-disc pl-5 text-sm leading-7 text-stone-700">
				<li>Primary source is SEC companyfacts data derived from 10-K and 10-Q filings.</li>
				<li>Raw reported facts are stored before metric-level interpretation is applied.</li>
				<li>Metric series are built from raw facts rather than from pre-aggregated vendor outputs.</li>
				<li>Lineage matters at each stage: raw fact → selected tag row → resolved period row → metric series row → signal or interpretation.</li>
				<li>A displayed value is only useful if it can be traced back to its filing context and transformation path.</li>
			</ul>
		</MethodologySection>
	);
}
