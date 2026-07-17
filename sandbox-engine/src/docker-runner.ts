import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { randomUUID } from "crypto";

const execFileAsync = promisify(execFile);

interface LanguageConfig {
  image: string;
  ext: string;
}

// One hardened, purpose-built Docker image per language (see sandbox-engine/docker/).
const LANGUAGE_CONFIG: Record<string, LanguageConfig> = {
  javascript: { image: "hynox-sandbox-js", ext: "js" },
  typescript: { image: "hynox-sandbox-ts", ext: "ts" },
  python: { image: "hynox-sandbox-python", ext: "py" },
  java: { image: "hynox-sandbox-java", ext: "java" },
  c: { image: "hynox-sandbox-c", ext: "c" },
  cpp: { image: "hynox-sandbox-cpp", ext: "cpp" },
};

export type SandboxStatus =
  | "success"
  | "compile_error"
  | "runtime_error"
  | "timeout"
  | "memory_limit_exceeded";

export interface SandboxResult {
  stdout: string;
  stderr: string;
  status: SandboxStatus;
  executionTimeMs: number;
  memoryUsedKb: number;
}

export function isSupportedLanguage(language: string): boolean {
  return Object.prototype.hasOwnProperty.call(LANGUAGE_CONFIG, language);
}

// Exit-code convention shared by every entrypoint script in docker/:
//   0   -> success (caller still needs to diff stdout against expected output)
//   100 -> compile_error (compiler/transpiler failed)
//   124 -> timeout (GNU coreutils `timeout` killed the process)
//   137 -> SIGKILL, treated as memory_limit_exceeded if State.OOMKilled confirms it,
//          otherwise treated as a runtime crash
//   anything else -> runtime_error
export async function runInDocker(
  language: string,
  sourceCode: string,
  stdin: string,
  timeLimitMs: number,
  memoryLimitMb: number
): Promise<SandboxResult> {
  const config = LANGUAGE_CONFIG[language];
  if (!config) {
    return {
      stdout: "",
      stderr: `Unsupported language: ${language}`,
      status: "runtime_error",
      executionTimeMs: 0,
      memoryUsedKb: 0,
    };
  }

  const runId = randomUUID();
  const tempDir = path.join(os.tmpdir(), `hynox-sandbox-${runId}`);
  const containerName = `hynox-sbx-${runId}`;
  const timeLimitSec = Math.max(1, Math.ceil(timeLimitMs / 1000));
  const memMb = Math.max(64, Math.min(512, memoryLimitMb || 256));

  await fs.mkdir(tempDir, { recursive: true });
  await fs.writeFile(path.join(tempDir, `solution.${config.ext}`), sourceCode, "utf-8");
  await fs.writeFile(path.join(tempDir, "input.txt"), stdin ?? "", "utf-8");

  const startTime = Date.now();
  let status: SandboxStatus = "success";
  let stdout = "";
  let stderr = "";

  try {
    await execFileAsync("docker", [
      "run",
      "-d",
      "--name",
      containerName,
      "--network",
      "none",
      `--memory=${memMb}m`,
      `--memory-swap=${memMb}m`,
      "--cpus=1",
      "--pids-limit=64",
      "--read-only",
      "--tmpfs",
      "/tmp:rw,exec,nosuid,size=128m",
      "--user",
      "1000:1000",
      "--cap-drop=ALL",
      "--security-opt",
      "no-new-privileges",
      "-e",
      `TIME_LIMIT_SEC=${timeLimitSec}`,
      "-e",
      `JAVA_MEM_MB=${Math.max(32, memMb - 32)}`,
      "-v",
      `${tempDir}:/box:ro`,
      config.image,
    ]);

    // Generous outer safety net on top of the in-container `timeout` — covers
    // Docker daemon hangs / image pull stalls that the container-side timer can't catch.
    const outerTimeoutMs = timeLimitMs + 10000;
    const waitResult = await Promise.race([
      execFileAsync("docker", ["wait", containerName]).then((r) => ({
        timedOut: false as const,
        exitCode: parseInt(r.stdout.trim(), 10),
      })),
      new Promise<{ timedOut: true }>((resolve) =>
        setTimeout(() => resolve({ timedOut: true }), outerTimeoutMs)
      ),
    ]);

    let exitCode = 0;
    if (waitResult.timedOut) {
      status = "timeout";
      try {
        await execFileAsync("docker", ["kill", containerName]);
      } catch {
        // already dead
      }
    } else {
      exitCode = waitResult.exitCode;
    }

    try {
      const logs = await execFileAsync("docker", ["logs", containerName], {
        maxBuffer: 5 * 1024 * 1024,
      });
      stdout = logs.stdout;
      stderr = logs.stderr;
    } catch (e: any) {
      stderr = stderr || e.message || "Failed to read sandbox logs.";
    }

    try {
      const inspect = await execFileAsync("docker", [
        "inspect",
        containerName,
        "--format",
        "{{.State.ExitCode}}|{{.State.OOMKilled}}",
      ]);
      const [exitCodeStr, oomStr] = inspect.stdout.trim().split("|");
      exitCode = parseInt(exitCodeStr, 10);
      if (oomStr === "true") {
        status = "memory_limit_exceeded";
      }
    } catch {
      // container may already be gone if outer timeout fired
    }

    if (status !== "timeout" && status !== "memory_limit_exceeded") {
      if (exitCode === 0) status = "success";
      else if (exitCode === 100) status = "compile_error";
      else if (exitCode === 124) status = "timeout";
      else if (exitCode === 137) status = "memory_limit_exceeded";
      else status = "runtime_error";
    }
  } catch (err: any) {
    status = "runtime_error";
    stderr = stderr || `Sandbox execution failed: ${err.message}`;
  } finally {
    try {
      await execFileAsync("docker", ["rm", "-f", containerName]);
    } catch {
      // already removed
    }
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }

  return {
    stdout,
    stderr,
    status,
    executionTimeMs: Date.now() - startTime,
    // Precise memory sampling would require polling `docker stats` during the run,
    // which isn't worth the overhead for short-lived judge containers — left unmeasured
    // rather than faked.
    memoryUsedKb: 0,
  };
}
