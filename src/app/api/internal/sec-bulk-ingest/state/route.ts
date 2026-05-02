import { NextResponse } from "next/server";
import { getSecBulkIngestState } from "@/backend/services/sec/companyFacts/bulk/secBulkIngestStateRepository";

export async function GET() {
  const state = await getSecBulkIngestState("companyfacts");

  return NextResponse.json({
    state,
  });
}
