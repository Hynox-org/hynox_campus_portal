import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const next = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
const tsNode = fileURLToPath(new URL("../node_modules/ts-node/dist/bin.js", import.meta.url));
const compilerOptions = JSON.stringify({ module: "commonjs", moduleResolution: "node" });
const web = spawn(process.execPath, [next, "dev", ...process.argv.slice(2)], { stdio: "inherit" });
const mail = spawn(process.execPath, [tsNode, "--compiler-options", compilerOptions,
  "-r", "tsconfig-paths/register", "scripts/onboarding-worker.ts"], { stdio: "inherit" });
const children = [web, mail];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) if (child.exitCode === null) child.kill();
}
for (const child of children) {
  child.once("error", () => { console.error("Local web/email process could not start."); stop(1); });
  child.once("exit", code => stop(code || 0));
}
process.once("SIGINT", () => stop());
process.once("SIGTERM", () => stop());
