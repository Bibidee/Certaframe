import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  return NextResponse.json({ ok: true, id, note: "Contracts are persisted client-side in IndexedDB for the MVP." });
}
