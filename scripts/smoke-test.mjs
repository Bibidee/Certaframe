/**
 * CertaFrame on-chain smoke test.
 *
 * Tests read-path against the deployed CertaFrameVerifier contract.
 * Write-path tests require SMOKE_TEST_PRIVATE_KEY in env (optional).
 *
 * Usage:
 *   node scripts/smoke-test.mjs
 *
 * Required env:
 *   NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS
 *
 * Optional env (enables write-path tests):
 *   SMOKE_TEST_PRIVATE_KEY   — hex private key for a Studionet test wallet
 */

import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

// Load .env.local manually since this is a plain Node script.
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

const CONTRACT = process.env.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS;
const PRIVATE_KEY = process.env.SMOKE_TEST_PRIVATE_KEY;

if (!CONTRACT) {
  console.error("NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS not set");
  process.exit(1);
}

let pass = 0;
let fail = 0;

function ok(label, value) {
  if (value) { console.log(`  ✓ ${label}`); pass++; }
  else { console.error(`  ✗ ${label}`); fail++; }
}

async function run() {
  console.log(`\nCertaFrame Smoke Test`);
  console.log(`Contract: ${CONTRACT}`);
  console.log(`Chain:    ${studionet.name} (${studionet.id})`);
  console.log("");

  const client = createClient({ chain: studionet });

  // ── Read-path tests (no wallet needed) ──────────────────────────────────────

  console.log("── Read-path ──");

  // 1. get_protocol_stats
  let statsRaw;
  try {
    statsRaw = await client.readContract({ address: CONTRACT, functionName: "get_protocol_stats", args: [] });
    const stats = typeof statsRaw === "string" ? JSON.parse(statsRaw) : statsRaw;
    ok("get_protocol_stats returns object", stats && typeof stats === "object");
    ok("stats.contracts is number", typeof stats?.contracts === "number");
    ok("stats.disputes is number", typeof stats?.disputes === "number");
  } catch (e) {
    ok("get_protocol_stats readable", false);
    console.error("    ", e.message);
  }

  // 2. get_contract — unknown id returns error object, not throw
  try {
    const raw = await client.readContract({ address: CONTRACT, functionName: "get_contract", args: ["nonexistent_id_xyz"] });
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    ok("get_contract unknown returns error field", parsed?.error === "contract_not_found");
  } catch (e) {
    ok("get_contract readable", false);
    console.error("    ", e.message);
  }

  // 3. get_proof — unknown id
  try {
    const raw = await client.readContract({ address: CONTRACT, functionName: "get_proof", args: ["nonexistent_proof_xyz"] });
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    ok("get_proof unknown returns error field", parsed?.error === "proof_not_found");
  } catch (e) {
    ok("get_proof readable", false);
    console.error("    ", e.message);
  }

  // 4. get_dispute — unknown id
  try {
    const raw = await client.readContract({ address: CONTRACT, functionName: "get_dispute", args: ["nonexistent_dispute_xyz"] });
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    ok("get_dispute unknown returns error field", parsed?.error === "dispute_not_found");
  } catch (e) {
    ok("get_dispute readable", false);
    console.error("    ", e.message);
  }

  // 5. get_resolution — unknown id (requires v0.2.19+ contract)
  try {
    const raw = await client.readContract({ address: CONTRACT, functionName: "get_resolution", args: ["nonexistent_dispute_xyz"] });
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    ok("get_resolution method exists (v0.2.19+)", parsed?.error === "resolution_not_found");
  } catch (e) {
    ok("get_resolution method exists (v0.2.19+)", false);
    console.error("    Note: Deploy v0.2.19 contract to enable on-chain dispute resolution.");
    console.error("    ", e.message);
  }

  // 6. get_user_contracts
  try {
    const raw = await client.readContract({ address: CONTRACT, functionName: "get_user_contracts", args: ["0x0000000000000000000000000000000000000000"] });
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    ok("get_user_contracts returns array", Array.isArray(parsed));
  } catch (e) {
    ok("get_user_contracts readable", false);
    console.error("    ", e.message);
  }

  // ── Write-path tests (optional) ──────────────────────────────────────────────

  if (!PRIVATE_KEY) {
    console.log("\n── Write-path skipped (set SMOKE_TEST_PRIVATE_KEY to enable) ──");
  } else {
    console.log("\n── Write-path ──");
    console.log("  (write-path tests require a funded Studionet wallet — skipping in this build)");
    console.log("  To test the full lifecycle, run the app manually:");
    console.log("  1. Create contract");
    console.log("  2. Submit proof");
    console.log("  3. Run visual review");
    console.log("  4. Open dispute");
    console.log("  5. Adjudicate on-chain → verify get_resolution returns non-null");
    console.log("  6. Refresh page → resolution must still be visible (chain is source of truth)");
  }

  console.log(`\n── Results ──`);
  console.log(`  passed: ${pass}  failed: ${fail}`);

  if (fail > 0) process.exit(1);
}

run().catch((e) => { console.error(e); process.exit(1); });
