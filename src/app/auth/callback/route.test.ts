import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));
import { createClient } from "@/utils/supabase/server";
import { GET } from "./route";

describe("Google login callback", () => {
  const rpc = vi.fn();
  const signOut = vi.fn();
  const exchange = vi.fn();
  let role: string;
  let roleError: object | null;
  beforeEach(() => {
    vi.clearAllMocks(); vi.unstubAllEnvs();
    role = "institution_admin"; roleError = null;
    exchange.mockResolvedValue({ data: { user: { id: "auth-user" } }, error: null });
    rpc.mockResolvedValue({ data: { id: "business-user", status: "active" }, error: null });
    signOut.mockResolvedValue({ error: null });
    const client = {
      auth: { exchangeCodeForSession: exchange, signOut }, schema: vi.fn().mockReturnThis(), rpc,
      from: vi.fn(() => ({ select: () => ({ eq: async () => ({ data: [{ roles: { name: role, priority: 80 } }], error: roleError }) }) })),
    };
    vi.mocked(createClient).mockResolvedValue(client as never);
  });
  const request = (next = "", headers?: HeadersInit) => new Request(`http://localhost:3000/auth/callback?code=valid${next ? `&next=${encodeURIComponent(next)}` : ""}`, { headers });
  it("uses atomic login without caller-supplied account identifiers", async () => {
    expect((await GET(request())).headers.get("location")).toContain("/institution");
    expect(rpc).toHaveBeenCalledExactlyOnceWith("complete_login");
  });
  it.each(["https://other.example", "//other.example", "/\\other.example", "/%5cother.example", "/%2fother.example"])("rejects unsafe next path %s", async next => {
    expect((await GET(request(next))).headers.get("location")).toBe("http://localhost:3000/institution");
  });
  it("keeps a safe application path and disables caching", async () => {
    const response = await GET(request("/institution?tab=roster"));
    expect(response.headers.get("location")).toBe("http://localhost:3000/institution?tab=roster");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it("ignores untrusted forwarded headers", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://campus.example.com");
    expect((await GET(request("", { "x-forwarded-host": "attacker.example", "x-forwarded-proto": "http" }))).headers.get("location")).toBe("https://campus.example.com/institution");
  });
  it.each(["AccountUnavailable", "AccountMismatch", "private database details"])("fails closed on completion error %s", async message => {
    rpc.mockResolvedValue({ data: null, error: { message } });
    expect((await GET(request())).headers.get("location")).toBe("http://localhost:3000/login?error=" + (message === "private database details" ? "OAuthExchangeFailed" : message));
    expect(signOut).toHaveBeenCalled();
  });
  it("fails closed when roles cannot be read", async () => {
    roleError = { message: "private details" };
    expect((await GET(request())).headers.get("location")).toContain("OAuthExchangeFailed");
    expect(signOut).toHaveBeenCalled();
  });
  it("routes an unprovisioned visitor to the public hub", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect((await GET(request())).headers.get("location")).toBe("http://localhost:3000/public");
  });
  it.each([["super_admin", "admin"], ["teacher", "teacher"], ["trainer", "teacher"], ["student", "student"], ["mentor", "public"], ["public", "public"]])("routes %s to %s", async (name, path) => {
    role = name; expect((await GET(request())).headers.get("location")).toBe("http://localhost:3000/" + path);
  });
  it("routes active shared accounts to dashboard selection", async () => {
    exchange.mockResolvedValue({ data: { user: { id: "auth-user", app_metadata: { shared_dashboard_login: true } } }, error: null });
    expect((await GET(request())).headers.get("location")).toContain("/super-admin-login/dashboards");
  });
  it("rejects shared accounts without an active provisioned identity", async () => {
    exchange.mockResolvedValue({ data: { user: { id: "auth-user", app_metadata: { shared_dashboard_login: true } } }, error: null });
    rpc.mockResolvedValue({ data: null, error: null });
    expect((await GET(request())).headers.get("location")).toContain("AccountUnavailable");
  });
  it("handles missing codes and throwing exchanges without exposing details", async () => {
    expect((await GET(new Request("http://localhost:3000/auth/callback"))).headers.get("location")).toContain("OAuthExchangeFailed");
    exchange.mockRejectedValue(new Error("private provider details"));
    expect((await GET(request())).headers.get("location")).toContain("OAuthExchangeFailed");
  });
});
