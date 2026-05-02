import { MethodologySection } from "@/features/methodology/components/MethodologySection";

export function Validation() {
	return (
		<MethodologySection eyebrow="09" title="Validation">
			<ul className="list-disc pl-5 text-sm leading-7 text-stone-700">
				<li>Definitional validation checks whether a metric still means what it claims to mean.</li>
				<li>Structural validation checks period continuity, chronology, and series integrity.</li>
				<li>Cross-metric validation checks whether related facts move in a coherent way.</li>
				<li>Outcome or external validation asks whether signals correspond to broader business or market reality.</li>
			</ul>
		</MethodologySection>
	);
}
