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
		<section className="border border-zinc-300 bg-white shadow-[4px_4px_0_0_rgba(24,24,27,0.08)]">
			<div className="border-b border-zinc-200 bg-[#f2f3ef] px-5 py-4">
				{eyebrow ? (
					<div className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-[#6d5a2d]">
						{eyebrow}
					</div>
				) : null}
				<h2 className="mt-2 text-xl font-semibold tracking-tight text-zinc-950">
					{title}
				</h2>
			</div>
			<div className="px-5 py-4">{children}</div>
		</section>
	);
}
