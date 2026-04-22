import { NextResponse } from "next/server";
import { runDataPipelineRefreshWorkflow } from "@/backend/workflows/data-pipeline-refresh/runDataPipelineRefreshWorkflow";

export async function POST() {
  try {
    void runDataPipelineRefreshWorkflow();

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Data pipeline refresh trigger failed:", error);

    return NextResponse.json(
      { ok: false, error: "trigger_failed" },
      { status: 500 },
    );
  }
}
