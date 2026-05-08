import Link from "next/link";
import type { ReactNode } from "react";

export function WorkstationFrame({
	title,
	backHref,
	backLabel,
	maxWidthClassName = "max-w-7xl",
	children,
}: {
	title: string;
	backHref?: string;
	backLabel?: string;
	maxWidthClassName?: string;
	children: ReactNode;
}) {
	return (
		<main className="min-h-screen bg-[#d8ddd2] px-3 py-4 text-zinc-950 md:px-5 md:py-6">
			<div className="overflow-hidden border border-zinc-950 bg-[#f6f7f4] shadow-[8px_8px_0_0_rgba(24,24,27,0.16)]">
				<div className="flex items-center justify-between border-b border-zinc-950 bg-[#173b35] px-3 py-2 text-[#f7f4ea]">
					<div className="flex items-center gap-2">
						<span className="h-2.5 w-2.5 border border-[#f7f4ea] bg-[#d8a541]" />
						<span className="font-mono text-xs font-semibold uppercase tracking-[0.22em]">
							{title}
						</span>
					</div>
					<div className="flex gap-1.5">
						<span className="h-3 w-3 border border-[#f7f4ea] bg-[#f7f4ea]/20" />
						<span className="h-3 w-3 border border-[#f7f4ea] bg-[#f7f4ea]/20" />
						<span className="h-3 w-3 border border-[#f7f4ea] bg-[#f7f4ea]/20" />
					</div>
				</div>

				{backHref && backLabel ? (
					<div className="border-b border-zinc-950 bg-[#eceee8] px-4 py-2 md:px-6">
						<Link
							href={backHref}
							className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-[#173b35] underline decoration-[#b88a2f] underline-offset-4 hover:text-zinc-950"
						>
							{backLabel}
						</Link>
					</div>
				) : null}

				<div className={`mx-auto px-4 py-6 md:px-6 md:py-8 ${maxWidthClassName}`}>
					{children}
				</div>
			</div>
		</main>
	);
}

export function WorkstationPanel({
	children,
	className = "",
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<section
			className={`border border-zinc-300 bg-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.9)] ${className}`}
		>
			{children}
		</section>
	);
}
