import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const proofId = req.nextUrl.searchParams.get("proofId");
  if (!proofId) return NextResponse.json({ ok: false, error: "missing proofId" }, { status: 400 });
  return NextResponse.json({ ok: true, proofId, note: "Reviews are persisted client-side in IndexedDB for the MVP." });
}
