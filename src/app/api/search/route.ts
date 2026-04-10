import { NextRequest, NextResponse } from "next/server";
import { searchCompanies } from "@/lib/queries";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");
  if (!q || q.trim().length < 2) {
    return NextResponse.json([]);
  }

  const limit = Math.min(
    parseInt(request.nextUrl.searchParams.get("limit") || "20", 10),
    100
  );

  const results = searchCompanies(q.trim(), limit);
  return NextResponse.json(results);
}
