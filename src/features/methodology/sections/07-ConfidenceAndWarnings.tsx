import { MethodologySection } from "@/features/methodology/components/MethodologySection";

export function ConfidenceAndWarnings() {
	return (
		<MethodologySection eyebrow="07" title="Confidence & Warnings">
			<ul className="list-disc pl-5 text-sm leading-7 text-stone-700">
				<li>Confidence is a property of the pipeline, not just the final number.</li>
				<li>Low-confidence outputs often come from weak period resolution, fallback-heavy tag selection, sparse coverage, or derived reconstruction.</li>
				<li>Warnings should tell the reader where to distrust the result, not merely that uncertainty exists.</li>
				<li>A cautious system is better than a falsely certain one, especially when company reporting behavior is inconsistent.</li>
			</ul>
		</MethodologySection>
	);
}
