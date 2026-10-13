import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/services/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
import { getCurrentUser } from "@/services/auth";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { chooseSharedDashboard, sharedSignIn } from "./actions";

describe("shared login actions", () => {
  const set = vi.fn(), remove = vi.fn(), signOut = vi.fn();
  const signInWithPassword = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cookies).mockResolvedValue({ set, delete: remove } as never);
    vi.mocked(createClient).mockResolvedValue({ auth: { signInWithPassword, signOut } } as never);
    vi.mocked(getCurrentUser).mockResolvedValue({ sharedLogin: true, availableRoles: ["student", "super_admin"], authUser: { id: "auth-1" }, tenantId: "campus-1", institution: { status: "active" } } as never);
  });
  it("refuses ordinary accounts on the shared login endpoint", async () => {
    signInWithPassword.mockResolvedValue({ data: { user: { app_metadata: {} } }, error: null });
    const form = new FormData(); form.set("email", "member@example.com"); form.set("password", "test-password");
    expect(await sharedSignIn(form)).toHaveProperty("error");
    expect(signOut).toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });
  it("does not leak authentication errors", async () => {
    signInWithPassword.mockResolvedValue({ data: {}, error: { message: "internal details" } });
    const form = new FormData(); form.set("email", "member@example.com"); form.set("password", "wrong-password");
    expect(await sharedSignIn(form)).toEqual({ error: "Unable to sign in. Check your email and password." });
  });
  it("selects student permissions and the student dashboard", async () => {
    const form = new FormData(); form.set("role", "student");
    await chooseSharedDashboard(form);
    expect(set).toHaveBeenCalledWith("campus-dashboard-role", "auth-1:student", expect.objectContaining({ sameSite: "lax", path: "/" }));
    expect(redirect).toHaveBeenCalledWith("/student");
  });
  it("rejects unassigned roles", async () => {
    const form = new FormData(); form.set("role", "teacher");
    await expect(chooseSharedDashboard(form)).rejects.toThrow("not assigned");
    expect(set).not.toHaveBeenCalled();
  });
  it("rejects ordinary users who forge a role selection", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ sharedLogin: false, availableRoles: ["super_admin"] } as never);
    const form = new FormData(); form.set("role", "super_admin");
    await expect(chooseSharedDashboard(form)).rejects.toThrow("not assigned");
    expect(set).not.toHaveBeenCalled();
  });
});
