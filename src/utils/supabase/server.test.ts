import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ admin: vi.fn(() => ({ type: "demo-server" })), session: vi.fn(() => ({ type: "authenticated" })), cookies: vi.fn(async () => ({ getAll: () => [], set: vi.fn() })) }));
vi.mock("./admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.session }));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
import { createClient } from "./server";

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

it("uses the existing privileged client only on the demo server without a user session", async () => {
  vi.stubEnv("DEMO_MODE", "true");
  expect(await createClient()).toEqual({ type: "demo-server" });
  expect(mocks.cookies).not.toHaveBeenCalled();
  expect(mocks.session).not.toHaveBeenCalled();
});

it("uses the original cookie session client when demo access is disabled", async () => {
  vi.stubEnv("DEMO_MODE", "false");
  expect(await createClient()).toEqual({ type: "authenticated" });
  expect(mocks.admin).not.toHaveBeenCalled();
  expect(mocks.cookies).toHaveBeenCalledOnce();
});
