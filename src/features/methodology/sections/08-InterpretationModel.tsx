import { MethodologySection } from "@/features/methodology/components/MethodologySection";

export function InterpretationModel() {
	return (
		<MethodologySection eyebrow="08" title="Interpretation Model">
			<ul className="list-disc pl-5 text-sm leading-7 text-stone-700">
				<li>Fact: the measured metric output or series behavior.</li>
				<li>Evidence: related metrics or signals that support or complicate the reading of that fact.</li>
				<li>Interpretation: a bounded explanation grounded in the visible evidence.</li>
				<li>Hypothesis: an optional higher-level narrative that should remain falsifiable and clearly separate from the measured fact.</li>
			</ul>

			<p className="mt-4 text-sm leading-7 text-stone-700">
				The main rule is that interpretation must remain auditable. Readers
				should be able to tell what was observed, what was inferred, and what
				could still be wrong.
			</p>
		</MethodologySection>
	);
}
