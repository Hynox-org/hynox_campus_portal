import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { proxy } from "./proxy";
import { DEMO_ROLE_COOKIE, DEMO_ROLE_HEADER } from "./lib/demo";
import { updateSession } from "./utils/supabase/middleware";

vi.mock("@/utils/supabase/middleware", () => ({ updateSession: vi.fn() }));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("demo request routing", () => {
  it("sets the new role on the first request and overwrites an incoming role header", async () => {
    const request = new NextRequest("http://localhost:3000/teacher", {
      headers: { cookie: `${DEMO_ROLE_COOKIE}=student`, [DEMO_ROLE_HEADER]: "super_admin" },
    });
    const response = await proxy(request);
    expect(response.headers.get(`x-middleware-request-${DEMO_ROLE_HEADER}`)).toBe("teacher");
    expect(response.cookies.get(DEMO_ROLE_COOKIE)?.value).toBe("teacher");
    expect(response.cookies.get(DEMO_ROLE_COOKIE)?.httpOnly).toBe(true);
    expect(updateSession).not.toHaveBeenCalled();
  });

  it("keeps the selected role for server action POSTs on shared course pages", async () => {
    const response = await proxy(new NextRequest("http://localhost:3000/academic/program/course", {
      method: "POST", headers: { cookie: `${DEMO_ROLE_COOKIE}=institution_admin` },
    }));
    expect(response.headers.get(`x-middleware-request-${DEMO_ROLE_HEADER}`)).toBe("institution_admin");
  });

  it.each(["/login", "/auth/callback?code=unused", "/onboarding/verify?token=unused", "/public"])("removes the login flow at %s", async (path) => {
    const response = await proxy(new NextRequest(`http://localhost:3000${path}`));
    expect(response.headers.get("location")).toBe("http://localhost:3000/demo");
    expect(updateSession).not.toHaveBeenCalled();
  });

  it("preserves the original login protection when demo mode is disabled", async () => {
    vi.stubEnv("DEMO_MODE", "false");
    vi.mocked(updateSession).mockResolvedValue({ supabase: {} as never, supabaseResponse: NextResponse.next(), user: null });
    const response = await proxy(new NextRequest("http://localhost:3000/student"));
    expect(response.headers.get("location")).toBe("http://localhost:3000/login");
    expect(updateSession).toHaveBeenCalledOnce();
  });
});
