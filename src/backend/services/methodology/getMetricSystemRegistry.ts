import { db } from "@/backend/config/db";

export async function getMetricSystemRegistry() {

	const factorsResult = await db.query(`
		SELECT
			key AS factor_key,
			name AS factor_name,
			category,
			description,
			display_order
		FROM factor_definitions
		WHERE is_active = true
		ORDER BY display_order, key
	`);

	const axesResult = await db.query(`
		SELECT
			key AS axis_key,
			name AS axis_name,
			description,
			display_order
		FROM factor_axis_definitions
		WHERE is_active = true
		ORDER BY display_order, key
	`);

	return {
		factors: factorsResult.rows,
		axes: axesResult.rows,
		metrics: [],
		methods: [],
	};

}
