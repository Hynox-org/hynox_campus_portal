import { createAdminClient } from "@/utils/supabase/admin";
import { executeAllTestsAndGrade } from "./runner";
import * as fs from "fs";
import * as path from "path";

// Sleep helper function
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Simple parser for .env.local to load credentials outside Next.js process
function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const firstEq = trimmed.indexOf("=");
      if (firstEq > 0) {
        const key = trimmed.substring(0, firstEq).trim();
        const value = trimmed.substring(firstEq + 1).trim().replace(/^['"]|['"]$/g, "");
        process.env[key] = value;
      }
    }
  }
}

// Startup recovery function to sweep crashed/hanging executions
async function recoverHangingJobs(supabase: ReturnType<typeof createAdminClient>) {
  console.log("[worker] [startup] Scanning for hanging jobs...");
  // Clear any jobs marked as running that were started more than 5 minutes ago
  const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  
  const { data: hangingJobs, error } = await supabase
    .schema("learning")
    .from("challenge_execution_queue")
    .select("*")
    .eq("status", "running")
    .lt("started_at", fiveMinsAgo);

  if (error) {
    console.error("[worker] Error fetching hanging jobs:", error);
    return;
  }

  if (hangingJobs && hangingJobs.length > 0) {
    console.log(`[worker] Found ${hangingJobs.length} hanging job(s) from a previous worker run. Marking them failed...`);
    for (const job of hangingJobs) {
      try {
        await supabase
          .schema("learning")
          .from("challenge_execution_queue")
          .update({ 
            status: "failed", 
            completed_at: new Date().toISOString(),
            error_message: "Execution engine worker terminated unexpectedly mid-run."
          })
          .eq("id", job.id);

        await supabase
          .schema("learning")
          .from("challenge_submissions")
          .update({ submission_status_code: "runtime_error" })
          .eq("id", job.submission_id);

        await supabase
          .schema("learning")
          .from("challenge_execution_logs")
          .insert({
            submission_id: job.submission_id,
            log_type: "system",
            log_message: "CRITICAL: The submission run was aborted because the runner node crashed or terminated unexpectedly."
          });

        const { data: sub } = await supabase
          .schema("learning")
          .from("challenge_submissions")
          .select("student_activity_progress_id")
          .eq("id", job.submission_id)
          .single();

        if (sub && sub.student_activity_progress_id) {
          await supabase
            .schema("learning")
            .from("student_activity_progress")
            .update({
              status_code: "failed",
              score: 0,
              completed_at: null,
              updated_at: new Date().toISOString()
            })
            .eq("id", sub.student_activity_progress_id);
        }
        console.log(`[worker] Recovered crashed run for submission: ${job.submission_id}`);
      } catch (recoveryErr) {
        console.error(`[worker] Failed to recover hanging job ${job.id}:`, recoveryErr);
      }
    }
  } else {
    console.log("[worker] No hanging jobs found. System is clean.");
  }
}

async function startWorker() {
  loadEnvLocal();
  const supabase = createAdminClient();
  console.log("[worker] Decoupled Judge Queue Worker is starting up...");
  
  // Perform worker crash recovery sweep on launch
  await recoverHangingJobs(supabase);

  console.log("[worker] Polling loop started. Listening for submissions...");

  while (true) {
    try {
      // Fetch oldest queued execution
      const { data: queuedItems, error } = await supabase
        .schema("learning")
        .from("challenge_execution_queue")
        .select("*")
        .eq("status", "queued")
        .order("created_at", { ascending: true })
        .limit(1);

      if (error) {
        console.error("[worker] Error reading queue:", error);
        await sleep(5000);
        continue;
      }

      if (!queuedItems || queuedItems.length === 0) {
        await sleep(1500); // Wait 1.5 seconds if queue is empty
        continue;
      }

      const item = queuedItems[0];
      
      // Run code compilation and grading
      await executeAllTestsAndGrade(item.submission_id);

      console.log(`[worker] [finished] Grading complete for submission: ${item.submission_id}`);
    } catch (err) {
      console.error("[worker] Unexpected exception in worker thread loop:", err);
      await sleep(5000);
    }
  }
}

startWorker().catch(err => {
  console.error("[worker] Fatal startup crash:", err);
  process.exit(1);
});
