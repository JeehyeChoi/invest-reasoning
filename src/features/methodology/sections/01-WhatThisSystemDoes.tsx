import { MethodologySection } from "@/features/methodology/components/MethodologySection";

export function WhatThisSystemDoes() {
	return (
		<MethodologySection
			eyebrow="01"
			title="What This System Does"
		>
			<p className="text-sm leading-7 text-stone-700">
				This system turns raw SEC filing data into metric series, factor
				signals, and interpretations that can be inspected end to end.
			</p>

			<p className="mt-3 text-sm leading-7 text-stone-700">
				The goal is not to hide messy reporting behind a clean number. The
				goal is to expose the selection logic, transformation logic, and
				interpretation logic that produced that number.
			</p>

			<p className="mt-3 text-sm leading-7 text-stone-700">
				This page is written for readers who care about implementation intent:
				what the system considers a valid metric, how it resolves ambiguity,
				and where the output should still be treated with caution.
			</p>
		</MethodologySection>
	);
}
