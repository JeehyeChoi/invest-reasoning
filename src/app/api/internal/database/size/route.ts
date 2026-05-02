// app/api/internal/database/size/route.ts

import { NextResponse } from "next/server";
import { getDatabaseSizeReport } from "@/backend/services/database/getDatabaseSizeReport";

export async function GET() {
  try {
    const report = await getDatabaseSizeReport();

    return NextResponse.json(report);
  } catch (error) {
    console.error("Database size API failed:", error);

    return NextResponse.json(
      { ok: false, error: "database_size_failed" },
      { status: 500 },
    );
  }
}
