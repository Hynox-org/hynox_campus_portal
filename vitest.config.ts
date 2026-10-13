import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // Scratch integration scripts can modify the shared database; run them explicitly.
  test: { include: ["src/**/*.test.{ts,tsx}"] },
});
