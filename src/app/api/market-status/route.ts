import { NextResponse } from "next/server";
import { getUsMarketState } from "@/backend/services/market/getUsMarketHolidays";

export async function GET() {
  try {
    const result = await getUsMarketState();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[market-status] route error:", error);

    return NextResponse.json(
      {
        state: "closed",
        label: "Unable to load market status",
        nowNy: null,
      },
      { status: 500 }
    );
  }
}
