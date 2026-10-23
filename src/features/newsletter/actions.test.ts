import { beforeEach, describe, expect, it, vi } from "vitest";

const { currentUser, createAdmin, query } = vi.hoisted(() => {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const name of ["from","select","eq","update","upsert"]) query[name] = vi.fn(() => query);
  query.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
  return { currentUser: vi.fn(), createAdmin: vi.fn(() => ({ schema: () => query })), query };
});
vi.mock("@/services/auth", () => ({ getCurrentUser: currentUser }));
vi.mock("@/utils/supabase/admin", () => ({ createAdminClient: createAdmin }));

import { loadNewsletterAdmin, saveNewsletterCourse, saveNewsletterSettings, saveStudentNewsletter } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
  currentUser.mockResolvedValue({ user: { id: "student-1", status: "active" }, primaryRole: "student", sharedLogin: false });
  query.eq.mockReturnValue(query); query.upsert.mockResolvedValue({ error: null }); query.maybeSingle.mockResolvedValue({ data: null, error: null });
});

describe("newsletter action authorization", () => {
  it("rejects unauthenticated callers before creating a privileged client", async () => {
    currentUser.mockResolvedValue(null);
    expect((await saveStudentNewsletter(true)).error).toContain("Sign in");
    expect(createAdmin).not.toHaveBeenCalled();
  });
  it("does not let a student read newsletter administration", async () => {
    expect((await loadNewsletterAdmin()).error).toContain("Sign in");
    expect(createAdmin).not.toHaveBeenCalled();
  });
  it("excludes shared demo accounts from subscriptions", async () => {
    currentUser.mockResolvedValue({ user: { id: "shared", status: "active" }, primaryRole: "student", sharedLogin: true });
    expect((await saveStudentNewsletter(true)).error).toContain("individual");
    expect(query.upsert).not.toHaveBeenCalled();
  });
  it("stores explicit consent only for the signed-in student", async () => {
    expect(await saveStudentNewsletter(true)).toEqual({ success: true });
    expect(query.upsert).toHaveBeenCalledWith(expect.objectContaining({ student_id: "student-1", enabled: true, consent_at: expect.any(String) }));
  });
  it("allows an opt-out without clearing provider suppression", async () => {
    query.maybeSingle.mockResolvedValue({ data: { suppressed_reason: "hard bounce" }, error: null });
    expect(await saveStudentNewsletter(false)).toEqual({ success: true });
    expect(query.upsert).toHaveBeenCalledWith(expect.objectContaining({ student_id: "student-1", enabled: false, consent_at: null }));
    expect(query.upsert.mock.calls[0][0]).not.toHaveProperty("suppressed_reason");
  });
  it("does not silently clear an unsubscribe or bounce", async () => {
    query.maybeSingle.mockResolvedValue({ data: { suppressed_reason: "unsubscribed" }, error: null });
    expect((await saveStudentNewsletter(true)).error).toContain("blocked or unsubscribed");
    expect(query.upsert).not.toHaveBeenCalled();
  });
  it("only writes allowlisted settings, even when a privileged caller submits extra keys", async () => {
    currentUser.mockResolvedValue({ user: { id: "admin", status: "active" }, primaryRole: "super_admin" });
    query.eq.mockResolvedValue({ error: null });
    await saveNewsletterSettings({ enabled: true, daily_limit: 250, credit_reserve: 50, send_hour: 8, lease_owner: "attacker" } as Parameters<typeof saveNewsletterSettings>[0]);
    expect(query.update).toHaveBeenCalledWith({ enabled: true, daily_limit: 250, credit_reserve: 50, send_hour: 8 });
  });
  it("rejects invalid course overrides and delivery caps", async () => {
    currentUser.mockResolvedValue({ user: { id: "admin", status: "active" }, primaryRole: "super_admin" });
    expect((await saveNewsletterCourse("bad-id", "Nursing", true)).error).toContain("Invalid course");
    expect((await saveNewsletterSettings({ enabled: true, daily_limit: 0, credit_reserve: 50, send_hour: 8 })).error).toContain("valid delivery");
    expect(query.upsert).not.toHaveBeenCalled();
  });
});
