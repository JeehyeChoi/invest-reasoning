import { MethodologySection } from "@/features/methodology/components/MethodologySection";

export function Coverage() {
	return (
		<MethodologySection eyebrow="11" title="Coverage">
			<ul className="list-disc pl-5 text-sm leading-7 text-stone-700">
				<li>Coverage should be read at more than one level: company coverage, period coverage, tag coverage, and metric coverage.</li>
				<li>A metric may exist for a company while still being weakly covered across fiscal periods.</li>
				<li>Comparability depends not just on presence, but on continuity and confidence across the compared range.</li>
				<li>Heavy users should treat sparse or irregular coverage as a methodological warning, not merely as missing data.</li>
			</ul>
		</MethodologySection>
	);
}
