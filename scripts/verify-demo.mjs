import assert from "node:assert/strict";

// Read-only route checks; this script never submits actions or modifies campus data.
const baseUrl = process.argv[2] || "http://127.0.0.1:3000";
for (const [path, role] of [["/admin", "super_admin"], ["/institution", "institution_admin"], ["/teacher", "teacher"], ["/student", "student"], ["/student/programming", "student"], ["/academic", "student"]]) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: "manual", signal: AbortSignal.timeout(30000) });
  const html = await response.text();
  assert.equal(response.status, 200, `${path} should open without login`);
  assert.match(response.headers.get("set-cookie") || "", new RegExp(`hynox-demo-role=${role}`));
  assert.doesNotMatch(html, /Demo .* profile is unavailable|Demo institution is unavailable|does not have the .* role/);
  console.log(`PASS ${path}: ${role}, HTTP 200`);
}
for (const path of ["/login", "/auth/callback?code=unused", "/onboarding/verify?token=unused", "/public"]) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: "manual", signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 307);
  assert.equal(new URL(response.headers.get("location"), baseUrl).pathname, "/demo");
  console.log(`PASS ${path}: redirects to role selection`);
}
const sharedPage = await fetch(`${baseUrl}/academic`, {
  headers: { cookie: "hynox-demo-role=teacher", "x-hynox-demo-role": "super_admin" },
  signal: AbortSignal.timeout(30000),
});
assert.equal(sharedPage.status, 200);
assert.match(sharedPage.headers.get("set-cookie") || "", /hynox-demo-role=teacher/);
assert.match(await sharedPage.text(), /Teacher Portal/);
console.log("PASS shared academic pages retain the selected role");
