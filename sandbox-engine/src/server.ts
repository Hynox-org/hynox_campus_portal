import express from "express";
import { runInDocker, isSupportedLanguage } from "./docker-runner";

const app = express();
app.use(express.json({ limit: "2mb" }));

const API_KEY = process.env.SANDBOX_ENGINE_API_KEY;
const MAX_SOURCE_LENGTH = 100_000;

app.post("/execute", async (req, res) => {
  if (API_KEY && req.header("x-api-key") !== API_KEY) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { language, sourceCode, stdin, timeLimitMs, memoryLimitMb } = req.body || {};

  if (typeof language !== "string" || !isSupportedLanguage(language)) {
    res.status(400).json({ error: "Invalid or unsupported language" });
    return;
  }
  if (typeof sourceCode !== "string" || sourceCode.length === 0 || sourceCode.length > MAX_SOURCE_LENGTH) {
    res.status(400).json({ error: "Invalid or oversized source code" });
    return;
  }
  if (stdin !== undefined && typeof stdin !== "string") {
    res.status(400).json({ error: "stdin must be a string" });
    return;
  }

  const clampedTimeLimitMs = Math.max(1000, Math.min(10000, Number(timeLimitMs) || 5000));
  const clampedMemoryLimitMb = Math.max(64, Math.min(512, Number(memoryLimitMb) || 256));

  try {
    const result = await runInDocker(
      language,
      sourceCode,
      typeof stdin === "string" ? stdin : "",
      clampedTimeLimitMs,
      clampedMemoryLimitMb
    );
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Sandbox execution failed" });
  }
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => {
  console.log(`[sandbox-engine] listening on port ${PORT}`);
});
