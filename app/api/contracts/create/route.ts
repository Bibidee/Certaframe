import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  return NextResponse.json({ ok: true, received: { contractId: body.contractId, contractHash: body.contractHash } });
}
