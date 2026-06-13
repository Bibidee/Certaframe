import { NextRequest, NextResponse } from "next/server";
import { ProofEnvelopeSchema } from "@/src/lib/envelope";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const r = ProofEnvelopeSchema.safeParse(body);
  if (!r.success) return NextResponse.json({ ok: false, error: r.error.message }, { status: 400 });
  return NextResponse.json({ ok: true, envelope: r.data });
}
