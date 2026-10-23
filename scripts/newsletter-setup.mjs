import { randomBytes } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const brevoKey = process.env.BREVO_API_KEY;
const senderEmail = process.env.BREVO_SENDER_EMAIL;
if (!url || !serviceKey || !brevoKey || !senderEmail) throw new Error("Supabase service credentials and Brevo sender configuration are required.");

async function rpc(name, body = {}) {
  const response = await fetch(`${url}/rest/v1/rpc/newsletter_${name}`, {
    method: "POST", headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", "Content-Profile": "learning", "Accept-Profile": "learning" },
    body: JSON.stringify(body), signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Newsletter setup database request failed (${response.status}).`);
  const text = await response.text(); return text ? JSON.parse(text) : null;
}

async function brevo(path, method = "GET", body) {
  const response = await fetch(`https://api.brevo.com/v3/${path}`, {
    method, headers: { "api-key": brevoKey, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const text = await response.text();
  const result = text ? JSON.parse(text) : null;
  if (!response.ok) {
    if (method === "GET" && path === "webhooks?type=marketing" && result?.code === "document_not_found") return { webhooks: [] };
    throw new Error(`Newsletter setup Brevo request failed (${response.status}, ${result?.code || "unknown"}).`);
  }
  return result;
}

const current = await rpc("runtime");
const schedulerToken = current.scheduler_token || randomBytes(32).toString("hex");
const functionUrl = `${url}/functions/v1/course-newsletter`;
await rpc("configure_transport", { p_values: {
  brevo_api_key: brevoKey, sender_email: senderEmail, sender_name: process.env.BREVO_SENDER_NAME || "Hynox Campus",
  scheduler_token: schedulerToken, function_url: functionUrl,
} });
console.log("Newsletter transport saved to encrypted Supabase Vault.");

const account = await brevo("account");
console.log(JSON.stringify({ brevoEmailPlan: account.plan?.filter(plan => ["free","subscription","payAsYouGo"].includes(plan.type)).map(plan => ({ type: plan.type, credits: plan.credits })) }));
const webhookUrl = `${functionUrl}?action=events`;
const webhooks = await brevo("webhooks?type=marketing");
const existing = webhooks.webhooks?.find(webhook => webhook.url === webhookUrl);
const webhook = { url: webhookUrl, description: "Hynox course newsletter suppression", events: ["unsubscribed","hardBounce","spam"], type: "marketing", headers: [{ key: "x-newsletter-token", value: schedulerToken }] };
await brevo(existing ? `webhooks/${existing.id}` : "webhooks", existing ? "PUT" : "POST", webhook);
console.log("Newsletter unsubscribe and bounce webhook configured.");

const unauthorized = await fetch(functionUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", signal: AbortSignal.timeout(20000) });
if (unauthorized.status !== 401) throw new Error(`Worker authentication check failed (${unauthorized.status}).`);
console.log("Worker rejects unauthenticated requests.");
if (process.argv.includes("--verify")) {
  const response = await fetch(functionUrl, { method: "POST", headers: { "Content-Type": "application/json", "x-newsletter-token": schedulerToken }, body: "{}", signal: AbortSignal.timeout(100000) });
  if (!response.ok) throw new Error(`Worker verification failed (${response.status}).`);
  console.log(JSON.stringify({ worker: await response.json() }));
}
