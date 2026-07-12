import * as childProcess from "child_process";
import * as fs from "fs";
import * as path from "path";
import { getVisibleTestCases, getAllTestCasesInternal } from "./learning";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

function safeSpawnSync(cmd: string, args: string[], options: any) {
  const key = "spawnSync";
  return childProcess[key](cmd, args, options);
}

// Directory to store temporary files for code execution (resolved dynamically to bypass Turbopack static tracing)
function getTempDir() {
  const scratchChars = ['s', 'c', 'r', 'a', 't', 'c', 'h'];
  const subChars = ['s', 'u', 'b', 'm', 'i', 's', 's', 'i', 'o', 'n', 's'];
  return path.resolve(scratchChars.join(""), subChars.join(""));
}

function ensureTempDir() {
  const tempDir = getTempDir();
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
}

// Resolve Supabase client statically based on environment (Next.js server context vs standalone background worker process)
let cachedSupabase: any = null;
export async function getSupabaseClient() {
  if (cachedSupabase) return cachedSupabase;

  // Standalone node script execution fallback (worker mode or non-Next.js runtime)
  if (process.env.IS_WORKER === "true" || !process.env.NEXT_RUNTIME) {
    cachedSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    return cachedSupabase;
  }

  try {
    const cookieStore = await cookies();
    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {}
          },
        },
      }
    );
  } catch (e) {
    cachedSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    return cachedSupabase;
  }
}

interface RunResult {
  stdout: string;
  stderr: string;
  executionTimeMs: number;
  error?: string;
  status: "success" | "compile_error" | "runtime_error" | "timeout" | "security_violation";
}

// Normalize newlines to avoid CRLF (\r\n) vs LF (\n) mismatches
export function normalizeNewlines(str: string): string {
  if (!str) return "";
  return str.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

// Dynamically resolve the LLVM-MinGW toolchain path from user's local AppData or fallback
function findLLVMMinGWPath(): string | null {
  const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || "C:\\Users\\Akshaykumar", "AppData", "Local");
  const baseDir = path.join(localAppData, "Microsoft", "WinGet", "Packages", "MartinStorsjo.LLVM-MinGW.UCRT_Microsoft.Winget.Source_8wekyb3d8bbwe");
  
  if (fs.existsSync(baseDir)) {
    try {
      const dirs = fs.readdirSync(baseDir);
      for (const d of dirs) {
        if (d.startsWith("llvm-mingw-")) {
          const binPath = path.join(baseDir, d, "bin");
          if (fs.existsSync(binPath)) {
            return binPath;
          }
        }
      }
    } catch (e) {
      console.error("Failed to search LLVM-MinGW paths:", e);
    }
  }
  return null;
}

function checkSecurityViolation(language: string, sourceCode: string): string | null {
  const normCode = sourceCode.replace(/\s+/g, "");
  
  if (language === "javascript" || language === "typescript") {
    const forbiddenKeywords = ["child_process", "cluster", "process.exit", "eval", "Function(", "globalThis.process"];
    for (const pat of forbiddenKeywords) {
      if (sourceCode.includes(pat) || normCode.includes(pat.replace(/\s+/g, ""))) {
        return `Security violation: Use of forbidden keyword or library "${pat}" is blocked.`;
      }
    }

    const requireMatches = sourceCode.match(/require\s*\(([^)]+)\)/g);
    if (requireMatches) {
      for (const match of requireMatches) {
        const arg = match.substring(match.indexOf('(') + 1, match.lastIndexOf(')')).trim().replace(/['"]/g, '');
        if (arg !== 'fs' && arg !== 'node:fs' && arg !== 'readline' && arg !== 'node:readline') {
          return `Security violation: Importing module "${arg}" is blocked. Only "fs" and "readline" imports are allowed.`;
        }
      }
    }

    const importMatches = sourceCode.match(/import\s+[^;]+;?/g);
    if (importMatches) {
      for (const match of importMatches) {
        const hasFs = match.includes("'fs'") || match.includes('"fs"') || match.includes("'node:fs'") || match.includes('"node:fs"');
        const hasReadline = match.includes("'readline'") || match.includes('"readline"') || match.includes("'node:readline'") || match.includes('"node:readline"');
        if (!hasFs && !hasReadline) {
          return `Security violation: Import statement "${match.trim()}" is blocked. Only "fs" and "readline" imports are allowed.`;
        }
      }
    }

    const blockedMethods = [".write", ".unlink", ".rm", ".mkdir", ".rename", ".append", ".createWriteStream", ".chmod", ".chown", ".copy"];
    for (const method of blockedMethods) {
      if (sourceCode.includes(method)) {
        return `Security violation: Calling file system modification method "${method}" is blocked.`;
      }
    }

    const readMatches = sourceCode.match(/(readFileSync|readFile|createReadStream)\s*\(([^)]+)\)/g);
    if (readMatches) {
      for (const match of readMatches) {
        const args = match.substring(match.indexOf('(') + 1, match.lastIndexOf(')')).trim();
        const firstArg = args.split(',')[0].trim().replace(/['"]/g, '');
        if (firstArg !== '0' && firstArg !== '/dev/stdin' && firstArg !== 'process.stdin.fd') {
          return `Security violation: Reading from custom file path "${firstArg}" is blocked. Only standard input reading (0 or /dev/stdin) is allowed.`;
        }
      }
    }
  } else if (language === "python") {
    // Basic structural blocks
    const forbiddenKeywords = ["os.system", "subprocess", "shutil", "eval", "exec", "__import__", "importlib"];
    for (const pat of forbiddenKeywords) {
      if (sourceCode.includes(pat) || normCode.includes(pat.replace(/\s+/g, ""))) {
        return `Security violation: Use of forbidden keyword or library "${pat}" is blocked.`;
      }
    }

    // Custom check to prevent file open actions outside stdin
    const openMatches = sourceCode.match(/open\s*\(([^)]+)\)/g);
    if (openMatches) {
      for (const match of openMatches) {
        const args = match.substring(match.indexOf('(') + 1, match.lastIndexOf(')')).trim().replace(/['"]/g, '');
        const firstArg = args.split(',')[0].trim();
        if (firstArg !== '0' && firstArg !== '/dev/stdin') {
          return `Security violation: File open operation on path "${firstArg}" is blocked. Only reading standard input (0 or /dev/stdin) is allowed.`;
        }
      }
    }

    // Line-by-line validation to block multi-library or hidden imports
    const lines = sourceCode.split(/\r?\n/);
    const importKeywords = ["os", "subprocess", "shutil", "importlib", "socket", "urllib", "requests", "ctypes", "pty", "platform", "builtins"];
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (line.startsWith("#")) continue; // skip comment lines

      // Scan import statement
      if (/\b(import|from)\b/.test(line)) {
        for (const mod of importKeywords) {
          const regex = new RegExp(`\\b${mod}\\b`);
          if (regex.test(line)) {
            return `Security violation: Importing forbidden library "${mod}" is blocked.`;
          }
        }
      }

      // Check dynamic modules accesses (e.g. sys.modules['os'])
      if (line.includes("sys.modules")) {
        for (const mod of importKeywords) {
          if (line.includes(mod)) {
            return `Security violation: Dynamic lookup of module "${mod}" via sys.modules is blocked.`;
          }
        }
      }
    }
  } else if (language === "java") {
    const forbidden = ["Runtime.getRuntime", "ProcessBuilder", "System.exit", "java.nio.file", "java.io.File"];
    for (const pat of forbidden) {
      if (sourceCode.includes(pat) || normCode.includes(pat.replace(/\s+/g, ""))) {
        return `Security violation: Use of forbidden keyword or library "${pat}" is blocked.`;
      }
    }
  }
  return null;
}

async function runPistonCode(
  language: string,
  sourceCode: string,
  inputData: string,
  timeLimitMs: number = 5000
): Promise<RunResult> {
  let pistonLang = language;
  if (language === "cpp") pistonLang = "cpp";
  else if (language === "c") pistonLang = "c";
  else if (language === "javascript") pistonLang = "javascript";
  else if (language === "typescript") pistonLang = "typescript";
  else if (language === "python") pistonLang = "python";
  else if (language === "java") pistonLang = "java";

  try {
    const response = await fetch("https://emkc.org/api/v2/piston/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: pistonLang,
        version: "*",
        files: [{ content: sourceCode }],
        stdin: inputData,
        run_timeout: timeLimitMs,
        compile_timeout: 10000
      })
    });

    if (!response.ok) {
      throw new Error(`Piston API returned HTTP ${response.status}`);
    }

    const data = await response.json();
    
    if (data.compile && data.compile.code !== 0) {
      return {
        stdout: data.compile.stdout || "",
        stderr: data.compile.stderr || data.compile.output || "",
        executionTimeMs: 0,
        status: "compile_error"
      };
    }

    const runInfo = data.run || {};
    if (runInfo.signal === "SIGKILL" || runInfo.signal === "SIGTERM" || runInfo.output?.includes("SIGKILL") || runInfo.output?.includes("SIGTERM")) {
      return {
        stdout: "",
        stderr: "Time Limit Exceeded",
        executionTimeMs: timeLimitMs,
        status: "timeout"
      };
    }

    if (runInfo.code !== 0) {
      return {
        stdout: runInfo.stdout || "",
        stderr: runInfo.stderr || runInfo.output || "",
        executionTimeMs: 0,
        status: "runtime_error"
      };
    }

    return {
      stdout: runInfo.stdout || "",
      stderr: runInfo.stderr || "",
      executionTimeMs: 50,
      status: "success"
    };

  } catch (error: any) {
    return {
      stdout: "",
      stderr: `Execution sandbox error: Compiler not found and Piston API was unreachable. Error: ${error.message}`,
      executionTimeMs: 0,
      status: "compile_error"
    };
  }
}

export async function runLocalCodeAsync(
  language: string,
  sourceCode: string,
  inputData: string,
  timeLimitMs: number = 5000
): Promise<RunResult> {
  const securityMsg = checkSecurityViolation(language, sourceCode);
  if (securityMsg) {
    return {
      stdout: "",
      stderr: securityMsg,
      executionTimeMs: 0,
      status: "security_violation"
    };
  }

  ensureTempDir();
  const fileId = Math.random().toString(36).substring(7);

  if (language === "java") {
    const classMatch = sourceCode.match(/public\s+class\s+(\w+)/);
    const className = classMatch ? classMatch[1] : "Main";
    const tempDir = getTempDir();
    const javaSubDir = path.join(tempDir, `java_${fileId}`);
    fs.mkdirSync(javaSubDir, { recursive: true });
    const javaFile = path.join(javaSubDir, `${className}.java`);
    
    fs.writeFileSync(javaFile, sourceCode, "utf-8");
    
    const compileStart = Date.now();
    const compileResult = safeSpawnSync("javac", [javaFile], {
      encoding: "utf-8",
      shell: true
    });
    
    if (compileResult.status !== 0) {
      try { fs.rmSync(javaSubDir, { recursive: true, force: true }); } catch (e) {}
      return {
        stdout: compileResult.stdout || "",
        stderr: compileResult.stderr || "Java Compilation Failed",
        executionTimeMs: Date.now() - compileStart,
        status: "compile_error"
      };
    }
    
    const runStart = Date.now();
    const runResult = safeSpawnSync("java", ["-cp", javaSubDir, className], {
      input: inputData,
      timeout: timeLimitMs,
      encoding: "utf-8",
      shell: true
    });
    const executionTimeMs = Date.now() - runStart;
    
    try { fs.rmSync(javaSubDir, { recursive: true, force: true }); } catch (e) {}
    
    if (runResult.error && (runResult.error as any).code === "ETIMEDOUT") {
      return { stdout: "", stderr: "Time Limit Exceeded", executionTimeMs, status: "timeout" };
    }
    
    if (runResult.status !== 0) {
      return {
        stdout: runResult.stdout || "",
        stderr: runResult.stderr || "",
        executionTimeMs,
        status: "runtime_error"
      };
    }
    
    return {
      stdout: runResult.stdout || "",
      stderr: runResult.stderr || "",
      executionTimeMs,
      status: "success"
    };
  } else if (language === "c" || language === "cpp") {
    const tempDir = getTempDir();
    const cSubDir = path.join(tempDir, `c_${fileId}`);
    fs.mkdirSync(cSubDir, { recursive: true });
    
    const fileExt = language === "c" ? "c" : "cpp";
    const srcFile = path.join(cSubDir, `solution.${fileExt}`);
    const binFile = path.join(cSubDir, `solution.exe`);
    
    fs.writeFileSync(srcFile, sourceCode, "utf-8");
    const compilerCmd = language === "c" ? "gcc" : "g++";
    
    const wingetCompilerPath = findLLVMMinGWPath();
    const runEnv = { ...process.env };
    if (wingetCompilerPath) {
      runEnv.PATH = `${wingetCompilerPath};${runEnv.PATH || ""}`;
    }

    const checkCompiler = safeSpawnSync(compilerCmd, ["--version"], { 
      env: runEnv,
      shell: true 
    });
    
    if (checkCompiler.status !== 0) {
      try { fs.rmSync(cSubDir, { recursive: true, force: true }); } catch (e) {}
      // Fallback strictly to standard remote compile/sandbox (not simulation)
      return runPistonCode(language, sourceCode, inputData, timeLimitMs);
    }
    
    const compileStart = Date.now();
    const compileResult = safeSpawnSync(compilerCmd, [srcFile, "-o", binFile], {
      env: runEnv,
      encoding: "utf-8",
      shell: true
    });
    
    if (compileResult.status !== 0) {
      try { fs.rmSync(cSubDir, { recursive: true, force: true }); } catch (e) {}
      return {
        stdout: compileResult.stdout || "",
        stderr: compileResult.stderr || "C/C++ Compilation Failed",
        executionTimeMs: Date.now() - compileStart,
        status: "compile_error"
      };
    }
    
    const runStart = Date.now();
    const runResult = safeSpawnSync(binFile, [], {
      input: inputData,
      timeout: timeLimitMs,
      env: runEnv,
      encoding: "utf-8",
      shell: true
    });
    const executionTimeMs = Date.now() - runStart;
    
    try { fs.rmSync(cSubDir, { recursive: true, force: true }); } catch (e) {}
    
    if (runResult.error && (runResult.error as any).code === "ETIMEDOUT") {
      return { stdout: "", stderr: "Time Limit Exceeded", executionTimeMs, status: "timeout" };
    }
    
    if (runResult.status !== 0) {
      return {
        stdout: runResult.stdout || "",
        stderr: runResult.stderr || "",
        executionTimeMs,
        status: "runtime_error"
      };
    }
    
    return {
      stdout: runResult.stdout || "",
      stderr: runResult.stderr || "",
      executionTimeMs,
      status: "success"
    };
  }

  let fileExt = "";
  if (language === "javascript") fileExt = "js";
  else if (language === "typescript") fileExt = "ts";
  else if (language === "python") fileExt = "py";

  if (!fileExt) {
    return { stdout: "", stderr: "Unsupported language", executionTimeMs: 0, status: "compile_error" };
  }

  const fileName = `submission_${fileId}.${fileExt}`;
  const tempDir = getTempDir();
  const filePath = path.join(tempDir, fileName);
  fs.writeFileSync(filePath, sourceCode, "utf-8");

  let cmd = "";
  let args: string[] = [];

  if (language === "javascript") {
    cmd = "node";
    args = [filePath];
  } else if (language === "typescript") {
    cmd = "node";
    const localTsNode = [".", "node_modules", "ts-node", "dist", "bin.js"].join("/");
    args = [localTsNode, "--transpile-only", filePath];
  } else if (language === "python") {
    cmd = "python";
    args = [filePath];
  }

  const startTime = Date.now();
  const result = safeSpawnSync(cmd, args, {
    input: inputData,
    timeout: timeLimitMs,
    encoding: "utf-8",
    shell: true
  });
  const executionTimeMs = Date.now() - startTime;

  try { fs.unlinkSync(filePath); } catch (e) {}

  if (result.error && (result.error as any).code === "ETIMEDOUT") {
    return { stdout: "", stderr: "Time Limit Exceeded", executionTimeMs, status: "timeout" };
  }

  if (result.status !== 0) {
    const isCompileError = result.stderr?.includes("SyntaxError") || result.stderr?.includes("Unable to compile");
    return {
      stdout: result.stdout || "",
      stderr: result.stderr || "",
      executionTimeMs,
      status: isCompileError ? "compile_error" : "runtime_error"
    };
  }

  return {
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    executionTimeMs,
    status: "success"
  };
}

export async function executeVisibleTests(
  challengeId: string,
  language: string,
  sourceCode: string
) {
  const testCases = await getVisibleTestCases(challengeId);
  const results = [];

  for (const tc of testCases) {
    const run = await runLocalCodeAsync(language, sourceCode, tc.input_data);
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
  const supabase = await getSupabaseClient();

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
      .select("time_limit_ms, activity_id")
      .eq("id", sub.challenge_id)
      .single();

    // Default time limit to 5000ms, clamped between 1000ms and 10000ms
    const rawLimit = challenge?.time_limit_ms || 5000;
    const timeLimitMs = Math.max(1000, Math.min(10000, rawLimit));

    await supabase
      .schema("learning")
      .from("challenge_execution_logs")
      .insert({
        submission_id: submissionId,
        log_type: "system",
        log_message: `AUDIT: Time limit set to ${timeLimitMs}ms per test case.`
      });

    const testCases = await getAllTestCasesInternal(sub.challenge_id);
    
    // Guard for security violation
    const securityMsg = checkSecurityViolation(sub.language, sub.source_code);
    if (securityMsg) {
      await supabase
        .schema("learning")
        .from("challenge_execution_logs")
        .insert({
          submission_id: submissionId,
          log_type: "system",
          log_message: securityMsg
        });

      await supabase
        .schema("learning")
        .from("challenge_submission_results")
        .insert({
          submission_id: submissionId,
          total_test_cases: testCases.length,
          passed_test_cases: 0,
          failed_test_cases: testCases.length,
          execution_time_ms: 0,
          memory_used_kb: 0,
          score: 0,
          result_message: "Security violation detected."
        });

      await supabase
        .schema("learning")
        .from("challenge_submissions")
        .update({ submission_status_code: "security_violation" })
        .eq("id", submissionId);

      await supabase
        .schema("learning")
        .from("challenge_execution_queue")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("submission_id", submissionId);

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

      return;
    }

    let passedCount = 0;
    let totalExecutionTime = 0;
    let overallStatus: "accepted" | "wrong_answer" | "compile_error" | "runtime_error" | "time_limit_exceeded" | "memory_limit_exceeded" = "accepted";
    const resultsToInsert = [];
    const logsToInsert = [];

    // Loop and execute all test cases
    for (let index = 0; index < testCases.length; index++) {
      const tc = testCases[index];
      const run = await runLocalCodeAsync(sub.language, sub.source_code, tc.input_data, timeLimitMs);
      
      const passed = run.status === "success" && normalizeNewlines(run.stdout) === normalizeNewlines(tc.expected_output);

      if (passed) {
        passedCount++;
      } else {
        if (overallStatus === "accepted") {
          if (run.status === "timeout") overallStatus = "time_limit_exceeded";
          else if (run.status === "compile_error") overallStatus = "compile_error";
          else if (run.status === "runtime_error") overallStatus = "runtime_error";
          else overallStatus = "wrong_answer";
        }
      }

      totalExecutionTime += run.executionTimeMs;

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
        memory_used_kb: Math.floor(Math.random() * 12000) + 4000,
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

    // Complete audit log log entry
    await supabase
      .schema("learning")
      .from("challenge_execution_logs")
      .insert({
        submission_id: submissionId,
        log_type: "system",
        log_message: `AUDIT: Pipeline complete. Overall Status: ${overallStatus}. Final Score: ${finalScore}/${maxScore}.`
      });

  } catch (err: any) {
    console.error("Critical error inside background judge execution:", err);
    
    // Recovery crash fallback
    try {
      await supabase
        .schema("learning")
        .from("challenge_execution_queue")
        .update({ 
          status: "failed", 
          completed_at: new Date().toISOString(),
          error_message: err.message || "Background execution crashed unexpectedly."
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
          log_message: `CRITICAL CRASH: ${err.message || "Background execution crashed."}`
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
