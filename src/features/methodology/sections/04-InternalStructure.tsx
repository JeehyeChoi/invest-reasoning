import { MethodologySection } from "@/features/methodology/components/MethodologySection";

export function InternalStructure() {
	return (
		<MethodologySection eyebrow="04" title="Internal Structure">
			<ul className="list-disc pl-5 text-sm leading-7 text-stone-700">
				<li>The system is organized around factor → axis → metric → interpretation layers.</li>
				<li>Metric definitions are separate from raw tag handling so that one concept can map to multiple filing expressions.</li>
				<li>Period resolution, metric construction, signal generation, and interpretation are distinct stages on purpose.</li>
				<li>This separation makes it easier to inspect where an error came from: source data, selection logic, transformation logic, or interpretation logic.</li>
			</ul>

			<p className="mt-4 text-sm leading-7 text-stone-700">
				For a heavy user, the important point is that the system is not one
				opaque formula. It is a staged pipeline with explicit boundaries.
			</p>
		</MethodologySection>
	);
}
