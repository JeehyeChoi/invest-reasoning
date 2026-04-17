import { NextResponse } from "next/server";
import { runSecBulkIngestWorkflow } from "@/backend/workflows/sec-bulk-ingest/runSecBulkIngestWorkflow";

export async function POST() {
  try {
    // 기다리지 않고 실행 (fire-and-forget 느낌)
    void runSecBulkIngestWorkflow();

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("SEC bulk trigger failed:", error);

    return NextResponse.json(
      { ok: false, error: "trigger_failed" },
      { status: 500 }
    );
  }
}
