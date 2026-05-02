import { MethodologySection } from "@/features/methodology/components/MethodologySection";

export function SECDataProcessing() {
	return (
		<MethodologySection eyebrow="03" title="SEC Data Processing">
			<ul className="list-disc pl-5 text-sm leading-7 text-stone-700">
				<li>Facts are filtered by usable units and screened for obviously invalid reporting patterns.</li>
				<li>Reported periods are classified into annual, quarterly, YTD, or unsupported shapes.</li>
				<li>Fiscal year and fiscal quarter are resolved from filing structure rather than assumed from calendar dates.</li>
				<li>52/53-week calendars and transition periods are treated as first-class edge cases.</li>
				<li>Duplicate, amended, or competing filing rows are ranked instead of blindly merged.</li>
				<li>Series are built per tag first, then elevated into metric-level selections.</li>
			</ul>

			<ul className="mt-4 list-disc pl-5 text-sm leading-7 text-stone-700">
				<li>Processing also preserves meta-signals: coverage, continuity, ambiguity, fallback usage, and whether a value was derived or directly reported.</li>
			</ul>
		</MethodologySection>
	);
}
