import { NextRequest, NextResponse } from "next/server";
import { getPersonWithCompanies } from "@/lib/queries";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const personId = parseInt(id, 10);
  if (isNaN(personId)) {
    return NextResponse.json({ error: "Invalid person ID" }, { status: 400 });
  }

  const data = getPersonWithCompanies(personId);
  if (!data) {
    return NextResponse.json({ error: "Person not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}
