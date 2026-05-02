import { MethodologySection } from "@/features/methodology/components/MethodologySection";

export function Limitations() {
	return (
		<MethodologySection eyebrow="10" title="Limitations">
			<ul className="list-disc pl-5 text-sm leading-7 text-stone-700">
				<li>SEC taxonomies do not guarantee semantic consistency across companies.</li>
				<li>The same business concept may be reported under different tags or different period shapes.</li>
				<li>Derived values can be analytically useful while still carrying reconstruction error.</li>
				<li>Industry context can change how the same metric should be read.</li>
				<li>Analytical outputs from this system are not equivalent to authoritative accounting truth.</li>
			</ul>
		</MethodologySection>
	);
}
