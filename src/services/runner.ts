import { errorMessage } from "@/lib/error-message";
import { getVisibleTestCases } from "./learning";
import { createAdminClient } from "@/utils/supabase/admin";
import { refreshProgressSnapshot } from "./course-progress";

interface RunResult {
  stdout: string;
  stderr: string;
  executionTimeMs: number;
  memoryUsedKb: number;
  status: "success" | "compile_error" | "runtime_error" | "timeout" | "memory_limit_exceeded";
}

// Normalize newlines to avoid CRLF (\r\n) vs LF (\n) mismatches
export function normalizeNewlines(str: string): string {
  if (!str) return "";
  return str.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

// Executes code in the sandbox-engine service, where it runs inside a locked-down
// Docker container (no network, capped CPU/memory/pids, read-only fs). This is the
// real security boundary — see sandbox-engine/src/docker-runner.ts.
async function runInSandbox(
  language: string,
  sourceCode: string,
  inputData: string,
  timeLimitMs: number,
  memoryLimitMb: number
): Promise<RunResult> {
  const engineUrl = process.env.SANDBOX_ENGINE_URL;
  if (!engineUrl) {
    return {
      stdout: "",
      stderr: "Sandbox engine is not configured (SANDBOX_ENGINE_URL missing).",
      executionTimeMs: 0,
      memoryUsedKb: 0,
      status: "runtime_error",
    };
  }

  try {
    const response = await fetch(`${engineUrl}/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.SANDBOX_ENGINE_API_KEY
          ? { "x-api-key": process.env.SANDBOX_ENGINE_API_KEY }
          : {}),
      },
      body: JSON.stringify({
        language,
        sourceCode,
        stdin: inputData,
        timeLimitMs,
        memoryLimitMb,
      }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      return {
        stdout: "",
        stderr: errBody.error || `Sandbox engine returned HTTP ${response.status}`,
        executionTimeMs: 0,
        memoryUsedKb: 0,
        status: "runtime_error",
      };
    }

    const data = await response.json();
    return {
      stdout: data.stdout || "",
      stderr: data.stderr || "",
      executionTimeMs: data.executionTimeMs || 0,
      memoryUsedKb: data.memoryUsedKb || 0,
      status: data.status || "runtime_error",
    };
  } catch (error) {
    return {
      stdout: "",
      stderr: `Failed to reach sandbox engine: ${errorMessage(error, "Unknown sandbox error")}`,
      executionTimeMs: 0,
      memoryUsedKb: 0,
      status: "runtime_error",
    };
  }
}

export async function executeVisibleTests(
  challengeId: string,
  language: string,
  sourceCode: string
) {
  const testCases = await getVisibleTestCases(challengeId);
  const results = [];

  for (const tc of testCases) {
    const run = await runInSandbox(language, sourceCode, tc.input_data, 5000, 256);
    const passed = run.status === "success" && normalizeNewlines(run.stdout) === normalizeNewlines(tc.expected_output);
    results.push({
      testCaseId: tc.id,
      input: tc.input_data,
      expected: tc.expected_output,
      actual: run.stdout,
      stderr: run.stderr,
      passed,
      executionTimeMs: run.executionTimeMs,
      status: run.status
    });
  }

  return results;
}

export async function executeAllTestsAndGrade(submissionId: string) {
  const supabase = createAdminClient();
  const { data: claimed, error: claimError } = await supabase.schema("learning").from("challenge_execution_queue")
    .update({ status: "running", started_at: new Date().toISOString() }).eq("submission_id", submissionId).eq("status", "queued").select("id").maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) return;

  // Load submission details
  const { data: sub, error: subError } = await supabase
    .schema("learning")
    .from("challenge_submissions")
    .select("*")
    .eq("id", submissionId)
    .single();

  if (subError || !sub) {
    console.error("Failed to load submission:", subError);
    return;
  }

  try {
    // Mark submission and execution queue status as running
    await supabase
      .schema("learning")
      .from("challenge_submissions")
      .update({ submission_status_code: "running" })
      .eq("id", submissionId);

    await supabase
      .schema("learning")
      .from("challenge_execution_queue")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("submission_id", submissionId);

    // Write initial audit start log
    await supabase
      .schema("learning")
      .from("challenge_execution_logs")
      .insert({
        submission_id: submissionId,
        log_type: "system",
        log_message: `AUDIT: Starting execution pipeline for submission ${submissionId} (Language: ${sub.language})`
      });

    const { data: challenge } = await supabase
      .schema("learning")
      .from("programming_challenges")
      .select("time_limit_ms, memory_limit_mb, activity_id")
      .eq("id", sub.challenge_id)
      .single();

    // Default time limit to 5000ms, clamped between 1000ms and 10000ms
    const rawLimit = challenge?.time_limit_ms || 5000;
    const timeLimitMs = Math.max(1000, Math.min(10000, rawLimit));
    const memoryLimitMb = Math.max(64, Math.min(512, challenge?.memory_limit_mb || 256));

    await supabase
      .schema("learning")
      .from("challenge_execution_logs")
      .insert({
        submission_id: submissionId,
        log_type: "system",
        log_message: `AUDIT: Time limit set to ${timeLimitMs}ms, memory limit ${memoryLimitMb}MB per test case.`
      });

    const { data: testCases, error: testError } = await supabase.schema("learning").from("challenge_test_cases")
      .select("*").eq("challenge_id", sub.challenge_id).order("position");
    if (testError) throw testError;
    if (!testCases?.length) throw new Error("Challenge has no test cases; it cannot be graded as accepted.");

    let passedCount = 0;
    let totalExecutionTime = 0;
    let peakMemoryKb = 0;
    let overallStatus: "accepted" | "wrong_answer" | "compile_error" | "runtime_error" | "time_limit_exceeded" | "memory_limit_exceeded" = "accepted";
    const resultsToInsert = [];
    const logsToInsert = [];

    // Loop and execute all test cases
    for (let index = 0; index < testCases.length; index++) {
      const tc = testCases[index];
      const run = await runInSandbox(sub.language, sub.source_code, tc.input_data, timeLimitMs, memoryLimitMb);

      const passed = run.status === "success" && normalizeNewlines(run.stdout) === normalizeNewlines(tc.expected_output);

      if (passed) {
        passedCount++;
      } else {
        if (overallStatus === "accepted") {
          if (run.status === "timeout") overallStatus = "time_limit_exceeded";
          else if (run.status === "compile_error") overallStatus = "compile_error";
          else if (run.status === "memory_limit_exceeded") overallStatus = "memory_limit_exceeded";
          else if (run.status === "runtime_error") overallStatus = "runtime_error";
          else overallStatus = "wrong_answer";
        }
      }

      totalExecutionTime += run.executionTimeMs;
      peakMemoryKb = Math.max(peakMemoryKb, run.memoryUsedKb);

      resultsToInsert.push({
        submission_id: submissionId,
        test_case_id: tc.id,
        passed,
        actual_output: tc.is_hidden ? null : run.stdout,
        expected_output: tc.is_hidden ? null : tc.expected_output,
        execution_time_ms: run.executionTimeMs
      });

      if (run.stderr) {
        logsToInsert.push({
          submission_id: submissionId,
          log_type: run.status === "compile_error" ? "compile" : "runtime",
          log_message: run.stderr
        });
      }

      // Add dynamic test case run audit logs
      logsToInsert.push({
        submission_id: submissionId,
        log_type: "system",
        log_message: `AUDIT: Test Case ${index + 1}/${testCases.length} run finished. Result Status: ${run.status}. Passed: ${passed}. Execution time: ${run.executionTimeMs}ms.`
      });
    }

    let maxScore = 100;
    if (challenge?.activity_id) {
      const { data: act } = await supabase
        .schema("learning")
        .from("activities")
        .select("max_score")
        .eq("id", challenge.activity_id)
        .single();
      if (act) maxScore = Number(act.max_score || 100);
    }

    const scorePercentage = passedCount / (testCases.length || 1);
    const finalScore = Number((scorePercentage * maxScore).toFixed(2));

    if (resultsToInsert.length > 0) {
      await supabase
        .schema("learning")
        .from("challenge_test_case_results")
        .insert(resultsToInsert);
    }

    if (logsToInsert.length > 0) {
      await supabase
        .schema("learning")
        .from("challenge_execution_logs")
        .insert(logsToInsert);
    }

    // Save submission overall grading report details
    await supabase
      .schema("learning")
      .from("challenge_submission_results")
      .insert({
        submission_id: submissionId,
        total_test_cases: testCases.length,
        passed_test_cases: passedCount,
        failed_test_cases: testCases.length - passedCount,
        execution_time_ms: totalExecutionTime,
        memory_used_kb: peakMemoryKb,
        score: finalScore,
        result_message: overallStatus === "accepted" ? "All test cases passed!" : `Mismatched outputs or execution errors. Status: ${overallStatus}`
      });

    await supabase
      .schema("learning")
      .from("challenge_submissions")
      .update({ submission_status_code: overallStatus })
      .eq("id", submissionId);

    await supabase
      .schema("learning")
      .from("challenge_execution_queue")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("submission_id", submissionId);

    const isCompleted = overallStatus === "accepted";
    await supabase
      .schema("learning")
      .from("student_activity_progress")
      .update({
        status_code: isCompleted ? "completed" : "failed",
        score: finalScore,
        completed_at: isCompleted ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq("id", sub.student_activity_progress_id);

    if (challenge?.activity_id) {
      const { data: activity, error } = await supabase.schema("learning").from("activities")
        .select("lesson_id").eq("id", challenge.activity_id).single();
      if (error) throw error;
      const { data: lesson, error: lessonError } = await supabase.schema("academic").from("lessons")
        .select("modules!inner(course_id)").eq("id", activity.lesson_id).single();
      if (lessonError) throw lessonError;
      const parent = Array.isArray(lesson.modules) ? lesson.modules[0] : lesson.modules;
      await refreshProgressSnapshot(sub.student_id, parent.course_id, supabase);
    }

    // Complete audit log log entry
    await supabase
      .schema("learning")
      .from("challenge_execution_logs")
      .insert({
        submission_id: submissionId,
        log_type: "system",
        log_message: `AUDIT: Pipeline complete. Overall Status: ${overallStatus}. Final Score: ${finalScore}/${maxScore}.`
      });

  } catch (err) {
    console.error("Critical error inside background judge execution:", err);

    // Recovery crash fallback
    try {
      await supabase
        .schema("learning")
        .from("challenge_execution_queue")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: errorMessage(err, "Judge execution failed") || "Background execution crashed unexpectedly."
        })
        .eq("submission_id", submissionId);

      await supabase
        .schema("learning")
        .from("challenge_submissions")
        .update({ submission_status_code: "runtime_error" })
        .eq("id", submissionId);

      await supabase
        .schema("learning")
        .from("challenge_execution_logs")
        .insert({
          submission_id: submissionId,
          log_type: "system",
          log_message: `CRITICAL CRASH: ${errorMessage(err, "Judge execution failed") || "Background execution crashed."}`
        });

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

    } catch (dbErr) {
      console.error("Failed to run pipeline crash recovery database updates:", dbErr);
    }
  }
}
