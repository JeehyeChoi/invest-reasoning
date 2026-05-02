import { NextResponse } from "next/server";

import { getMetricSystemRegistry } from "@/backend/services/methodology/getMetricSystemRegistry";

export async function GET() {
	const data = await getMetricSystemRegistry();

	return NextResponse.json(data);
}
