import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/server", () => ({ NextResponse: { redirect: (url: string) => ({ url }) } }));
import { createClient } from "@/utils/supabase/server";
import { GET } from "./route";

describe("Google login callback", () => {
  let invitationUpdate: ReturnType<typeof vi.fn>;
  let expiryFilter: ReturnType<typeof vi.fn>;
  let businessUser: { id: string; auth_user_id: string | null };
  beforeEach(() => {
    businessUser = { id: "business-user", auth_user_id: "auth-user" };
    invitationUpdate = vi.fn();
    expiryFilter = vi.fn();
    const client = {
      auth: { exchangeCodeForSession: vi.fn().mockResolvedValue({ data: { user: { id: "auth-user", email: "member@example.com" } }, error: null }) },
      schema: vi.fn().mockReturnThis(), rpc: vi.fn().mockResolvedValue({ error: null }),
      from: vi.fn((table: string) => {
        const data = table === "users" ? businessUser : table === "user_roles" ? [{ roles: { name: "institution_admin", priority: 80 } }] : null;
        const query = {
          select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(),
          gte: vi.fn((...args) => { expiryFilter(...args); return query; }),
          maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
          update: vi.fn((row) => { if (table === "user_invitations") invitationUpdate(row); return query; }),
          then: (resolve: (value: unknown) => void) => resolve({ data, error: null }),
        };
        return query;
      }),
    };
    vi.mocked(createClient).mockResolvedValue(client as never);
  });
  it("accepts a returning account's pending invitations, excluding expired invitations", async () => {
    const response = await GET(new Request("http://localhost:3000/auth/callback?code=valid"));
    expect(response.url).toMatch(/\/institution$/);
    expect(invitationUpdate).toHaveBeenCalledWith({ status: "accepted", accepted_at: expect.any(String) });
    expect(expiryFilter).toHaveBeenCalledWith("expires_at", expect.any(String));
  });
  it.each(["https://other.example", "//other.example", "/\\other.example"])("uses the role dashboard instead of redirecting to %s", async (next) => {
    const response = await GET(new Request(`http://localhost:3000/auth/callback?code=valid&next=${encodeURIComponent(next)}`));
    expect(response.url).toMatch(/\/institution$/);
  });
  it("keeps a safe application path", async () => {
    expect((await GET(new Request("http://localhost:3000/auth/callback?code=valid&next=%2Finstitution%3Ftab%3Droster"))).url).toMatch(/\/institution\?tab=roster$/);
  });
  it("does not accept invitations linked to a different identity", async () => {
    businessUser.auth_user_id = "another-identity";
    expect((await GET(new Request("http://localhost:3000/auth/callback?code=valid"))).url).toMatch(/AccountMismatch$/);
    expect(invitationUpdate).not.toHaveBeenCalled();
  });
});
