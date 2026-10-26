import { loadEnvConfig } from "@next/env";
import { createAdminClient } from "../src/utils/supabase/admin";
import { setTimeout as pause } from "node:timers/promises";

async function run() {
  loadEnvConfig(process.cwd());
  if (!process.env.BREVO_API_KEY || !process.env.NEXT_PUBLIC_APP_URL) throw new Error("Onboarding worker configuration is incomplete.");
  const client = createAdminClient();
  if (process.argv.includes("--check")) {
    console.log("Onboarding worker configuration loaded; no emails dispatched.");
    return;
  }
  // Load the mail client after environment configuration, outside the web request lifecycle.
  const { processNextOnboardingMail } = await import("../src/services/onboarding-mail");
  if (process.argv.includes("--once")) {
    console.log(await processNextOnboardingMail(client) ? "One onboarding email attempt processed." : "No onboarding email is ready.");
    return;
  }
  let stopping = false;
  process.once("SIGTERM", () => { stopping = true; });
  process.once("SIGINT", () => { stopping = true; });
  console.log("Onboarding mail worker started.");
  while (!stopping) {
    try {
      const processed = await processNextOnboardingMail(client);
      await pause(processed ? 250 : 2000);
    } catch {
      console.error("Onboarding worker could not complete a cycle; retrying.");
      await pause(5000);
    }
  }
}
run().catch(() => { console.error("Onboarding worker could not start. Check server configuration."); process.exitCode = 1; });
