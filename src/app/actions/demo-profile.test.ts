import { afterEach, expect, it, vi } from "vitest";
import { DEMO_USERS } from "@/lib/demo";

const getUser = vi.hoisted(() => vi.fn(async () => null));
vi.mock("@/services/auth", () => ({ getCurrentUser: getUser }));
vi.mock("@/services/onboarding", () => ({}));
import { deleteUserAction } from "./institution-actions";

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

it("protects all four existing profiles without performing a delete", async () => {
  vi.stubEnv("DEMO_MODE", "true");
  for (const userId of Object.values(DEMO_USERS)) {
    expect(await deleteUserAction(userId)).toEqual({ error: "This profile is required for demo access and cannot be deleted." });
  }
  expect(getUser).not.toHaveBeenCalled();
});

it("leaves normal authorization in place when the demo is disabled", async () => {
  vi.stubEnv("DEMO_MODE", "false");
  expect(await deleteUserAction(DEMO_USERS.student)).toEqual({ error: "Access denied." });
  expect(getUser).toHaveBeenCalledOnce();
});
