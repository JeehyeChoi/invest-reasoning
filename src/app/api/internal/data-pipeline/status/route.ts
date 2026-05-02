// src/app/api/internal/data-pipeline/status/route.ts

import { NextResponse } from "next/server";
import { getDataPipelineRefreshStatus } from "@/backend/workflows/data-pipeline-refresh/dataPipelineRefreshRuntimeState";

export async function GET() {
  return NextResponse.json(getDataPipelineRefreshStatus());
}
