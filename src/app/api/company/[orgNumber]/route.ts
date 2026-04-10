import { NextRequest, NextResponse } from "next/server";
import { getCompanyDetail, getFinancialHistory, getCompanyPeople } from "@/lib/queries";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orgNumber: string }> }
) {
  const { orgNumber } = await params;
  const detail = getCompanyDetail(orgNumber);
  if (!detail) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const history = getFinancialHistory(orgNumber);
  const people = getCompanyPeople(orgNumber);

  return NextResponse.json({ ...detail, history, people });
}
