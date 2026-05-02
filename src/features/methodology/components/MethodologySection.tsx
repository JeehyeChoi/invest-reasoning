import type { ReactNode } from "react";

type MethodologySectionProps = {
	title: string;
	eyebrow?: string;
	children: ReactNode;
};

export function MethodologySection({
	title,
	eyebrow,
	children,
}: MethodologySectionProps) {
	return (
		<section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm shadow-stone-200/50 md:p-6">
			{eyebrow ? (
				<div className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500">
					{eyebrow}
				</div>
			) : null}
			<h2 className="mt-2 text-xl font-semibold tracking-tight text-stone-950">
				{title}
			</h2>
			<div className="mt-4">{children}</div>
		</section>
	);
}
