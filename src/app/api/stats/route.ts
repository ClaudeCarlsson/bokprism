import { NextResponse } from "next/server";
import { getSiteStats } from "@/lib/queries";

export async function GET() {
  const stats = getSiteStats();
  return NextResponse.json(stats);
}
