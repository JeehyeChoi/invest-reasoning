import { MethodologySection } from "@/features/methodology/components/MethodologySection";

export function FileMap() {
	return (
		<MethodologySection eyebrow="12" title="File / Module Map">
			<ul className="list-disc pl-5 text-sm leading-7 text-stone-700">
				<li>Backend services handle raw SEC ingestion, period resolution, metric construction, signal generation, and validation.</li>
				<li>Factor/axis display, metric display, feature definitions, and signal rules are stored in database tables seeded by SQL files under `db/`.</li>
				<li>The remaining TypeScript factor blueprints define metric membership and workflow inputs; they are not the source for signal thresholds or vector eligibility.</li>
				<li>Methodology UI is the explanation layer that mirrors the internal pipeline rather than replacing it.</li>
				<li>For a developer, this section exists to connect conceptual stages on the page with concrete modules in the codebase.</li>
			</ul>
		</MethodologySection>
	);
}
