import { MethodologySection } from "@/features/methodology/components/MethodologySection";

type MetricSystemProps = {
	data: {
		factors: any[];
		axes: any[];
		metrics: any[];
		methods: any[];
	};
};

export function MetricSystem({ data }: MetricSystemProps) {
	const { factors, axes } = data;

	return (
		<MethodologySection eyebrow="05" title="Metric System">
			<ul className="list-disc pl-5 text-sm leading-7 text-stone-700">
				<li>Metrics are treated as defined analytical objects, not just labels attached to reported values.</li>
				<li>Each metric needs a concept definition, tag-selection logic, period logic, and interpretation context.</li>
				<li>Current active topology: {factors.length} factor definitions and {axes.length} scoring axes.</li>
			</ul>

			<div className="mt-5 grid gap-4 md:grid-cols-2">
				<div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
					<div className="text-sm font-semibold text-stone-900">Factors</div>

					<ul className="mt-3 list-disc pl-5 text-sm leading-7 text-stone-700">
						{factors.map((factor) => (
							<li key={factor.factor_key}>
								<span className="font-medium text-stone-900">{factor.factor_key}</span>
								{factor.factor_name ? ` — ${factor.factor_name}` : null}
							</li>
						))}
					</ul>
				</div>

				<div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
					<div className="text-sm font-semibold text-stone-900">Axes</div>

					<ul className="mt-3 list-disc pl-5 text-sm leading-7 text-stone-700">
						{axes.map((axis) => (
							<li key={axis.axis_key}>
								<span className="font-medium text-stone-900">{axis.axis_key}</span>
								{axis.axis_name ? ` — ${axis.axis_name}` : null}
							</li>
						))}
					</ul>
				</div>
			</div>
		</MethodologySection>
	);
}
