import { NewsletterDatabase, runNewsletters, suppressNewsletterContact } from "../../../src/features/newsletter/engine.ts";

Deno.serve(async request => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const db = new NewsletterDatabase(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  try {
    const secrets = await db.rpc("runtime");
    const supplied = request.headers.get("x-newsletter-token") || "";
    if (!secrets.scheduler_token || supplied !== secrets.scheduler_token) return new Response("Unauthorized", { status: 401 });
    if (new URL(request.url).searchParams.get("action") === "events") {
      const text = await request.text();
      if (text.length > 20000) return new Response("Payload too large", { status: 413 });
      const event = JSON.parse(text);
      if (["unsubscribe", "unsubscribed", "hardBounce", "hard_bounce", "spam", "spamComplaint"].includes(event.event) && typeof event.email === "string" && event.email.length < 255) {
        await suppressNewsletterContact(db, event.email, `Brevo: ${event.event}`);
      }
      return Response.json({ received: true });
    }
    return Response.json(await runNewsletters(db, secrets));
  } catch (error) {
    console.error("Newsletter worker failed:", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ error: "Newsletter job failed. Check newsletter status and function logs." }, { status: 500 });
  }
});
