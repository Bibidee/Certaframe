import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  return NextResponse.json({ ok: true, received: { proofId: body.proofId, contractId: body.contractId, envelopeHash: body.envelopeHash } });
}
