// Read-only REST/schema contract check; does not verify browser sessions or RLS.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

nextEnv.loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
const source = readFileSync("src/services/onboarding.ts", "utf8");
const listing = source.slice(source.indexOf("export async function listOnboardingInvitations"));
const columns = listing.match(/\.select\("([^"]+)"\)/)?.[1];
assert.ok(columns, "Invitation listing selector was not found");
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const invitations = await client.schema("core").from("user_invitations").select(columns)
  .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(1);
assert.ifError(invitations.error);
const institutions = await client.schema("institution").from("institutions").select("id").limit(1);
assert.ifError(institutions.error);
if (institutions.data.length) {
  const names = await client.schema("institution").from("institutions").select("id,name").in("id", institutions.data.map(row => row.id));
  assert.ifError(names.error);
  assert.equal(names.data.length, institutions.data.length);
}
const result = { checkedAt: new Date().toISOString(), invitationRestQuery: "passed", institutionBatchQuery: "passed", writes: 0 };
writeFileSync("output/testing/module-02/rest-schema-check.json", JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
