import { NextRequest, NextResponse } from "next/server";
import { getRankings } from "@/lib/queries";
import { RANKABLE_METRICS } from "@/lib/types";

const validMetrics = new Set<string>(RANKABLE_METRICS.map(m => m.key));

export async function GET(request: NextRequest) {
  const metric = request.nextUrl.searchParams.get("metric") || "Nettoomsattning";
  const order = request.nextUrl.searchParams.get("order") === "asc" ? "asc" : "desc";
  const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") || "50", 10), 200);
  const minPeriod = request.nextUrl.searchParams.get("minPeriod") || undefined;

  if (!validMetrics.has(metric)) {
    return NextResponse.json({ error: "Invalid metric" }, { status: 400 });
  }

  const results = getRankings(metric, order as "asc" | "desc", limit, minPeriod);
  return NextResponse.json(results);
}
