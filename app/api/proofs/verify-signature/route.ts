import { NextRequest, NextResponse } from "next/server";
import { verifyTypedData } from "viem";
import { EIP712_DOMAIN, EIP712_TYPES } from "@/src/lib/envelope";

export async function POST(req: NextRequest) {
  const { envelope, signature, expectedSigner } = await req.json();
  try {
    const valid = await verifyTypedData({
      address: expectedSigner, domain: EIP712_DOMAIN as any, types: EIP712_TYPES as any,
      primaryType: "ProofEnvelope", message: envelope, signature,
    });
    return NextResponse.json({ ok: true, valid });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 400 });
  }
}
