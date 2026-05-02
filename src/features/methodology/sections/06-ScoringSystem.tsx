import { MethodologySection } from "@/features/methodology/components/MethodologySection";

export function ScoringSystem() {
	return (
		<MethodologySection eyebrow="06" title="Scoring System">
			<ul className="list-disc pl-5 text-sm leading-7 text-stone-700">
				<li>Scoring is downstream from metric construction; it should not hide unresolved metric ambiguity.</li>
				<li>The current direction is signal vectors, baselines, and relative positions rather than one opaque heuristic score.</li>
			</ul>

			<div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm leading-7 text-stone-700">
				The intended contract is: metric outputs establish the measurable
				facts, scoring establishes relative positioning, and interpretation
				explains what that positioning may imply without pretending it is a
				direct statement of truth.
			</div>
		</MethodologySection>
	);
}
