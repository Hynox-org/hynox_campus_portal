import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/utils/email", () => ({ sendOnboardingEmail: vi.fn() }));
vi.mock("@/utils/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { parseCsv, processCsvOnboarding, onboardSingleUser, onboardSuperAdmin, regenerateInvitation, verifyInvitation } from "./onboarding";
import { sendOnboardingEmail } from "@/utils/email";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

describe("bulk onboarding CSV", () => {
  it("keeps quoted names and escaped quotes intact", () => {
    expect(parseCsv('name,email,role\r\n"Kumar, Akshay ""A""",student@example.com,student')).toEqual([
      { name: 'Kumar, Akshay "A"', email: "student@example.com", role: "student", institution_id: undefined },
    ]);
  });

  it("supports an Excel BOM and default student role", () => {
    expect(parseCsv('\uFEFFName,Email\r\nAkshay,student@example.com\r\n')).toEqual([
      { name: "Akshay", email: "student@example.com", role: "student", institution_id: undefined },
    ]);
  });
});

describe("onboarding dispatch", () => {
  let roleWrites: ReturnType<typeof vi.fn>;
  let userFilters: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.clearAllMocks();
    roleWrites = vi.fn();
    userFilters = vi.fn();
    vi.mocked(sendOnboardingEmail).mockResolvedValue(undefined as never);
    const client = { schema: vi.fn().mockReturnThis(), from: vi.fn((table: string) => {
      const data = table === "roles" ? [{ id: "role-student", name: "student" }, { id: "role-admin", name: "super_admin" }]
        : table === "institutions" ? [{ id: "campus-1", name: "QA Campus" }]
        : table === "user_invitations" ? { id: "invite-1", tenant_id: "campus-1", invitation_type: "student_onboarding", user: { id: "existing-user", email: "student@example.com", full_name: "Student" } }
        : { id: "existing-user" };
      const query = {
        select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
        single: vi.fn().mockResolvedValue({ data, error: null }),
        insert: vi.fn().mockImplementation((row) => { if(table === "user_roles")roleWrites(row); return query; }),
        upsert: vi.fn().mockImplementation((row) => { if(table === "user_roles")roleWrites(row); return query; }),
        update: vi.fn().mockReturnThis(),
        is: vi.fn().mockImplementation((...args) => { if(table === "users") userFilters(...args); return query; }),
        then: (resolve: (value: unknown) => void) => resolve({ data, error: null }),
      };
      return query;
    }) };
    vi.mocked(createClient).mockResolvedValue(client as never);
  });
  it.each(["bulk", "single"])("%s assigns the requested role for an existing user", async (mode) => {
    if (mode === "bulk") await processCsvOnboarding("name,email,role\nStudent,student@example.com,student", "campus-1", "admin-1");
    else await onboardSingleUser({ name: "Student", email: "student@example.com", role: "student", institutionId: "campus-1", invitedByUserId: "admin-1" });
    expect(roleWrites).toHaveBeenCalledWith({ user_id: "existing-user", role_id: "role-student" });
  });
  it.each(["bulk", "single", "super admin"])("reports an email failure instead of claiming a successful %s invitation", async (mode) => {
    vi.mocked(sendOnboardingEmail).mockRejectedValue(new Error("Email provider unavailable"));
    const result = mode === "bulk" ? (await processCsvOnboarding("name,email,role\nStudent,student@example.com,student", "campus-1", "admin-1"))[0]
      : mode === "single" ? await onboardSingleUser({ name: "Student", email: "student@example.com", role: "student", institutionId: "campus-1", invitedByUserId: "admin-1" })
      : await onboardSuperAdmin({ name: "Admin", email: "admin@example.com", invitedByUserId: "admin-1" });
    expect(result.status).toBe("error");
    expect(result.error).toMatch(/email/i);
  });
  it("reports a failed regenerated invitation email", async () => {
    vi.mocked(sendOnboardingEmail).mockRejectedValue(new Error("Email provider unavailable"));
    await expect(regenerateInvitation("invite-1", "admin-1")).rejects.toThrow(/email failed/);
  });
  it("does not reset an activated account to invited when regenerating its invitation", async () => {
    await regenerateInvitation("invite-1", "admin-1");
    expect(userFilters).toHaveBeenCalledWith("auth_user_id", null);
  });
});

describe("invitation verification before login", () => {
  const invitation = {
    id: "invite-1", token: "test-invitation-token", status: "sent",
    expires_at: "2099-01-01", invitation_type: "student_onboarding",
    user: { id: "student-1", full_name: "Akshay", email: "student@example.com", tenant_id: "campus-1" },
  };
  let campusQuery: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    invitation.status = "sent";
    invitation.expires_at = "2099-01-01";
    campusQuery = vi.fn().mockResolvedValue({ data: { name: "Hynox QA Campus" }, error: null });
    const client = (privileged: boolean) => ({ schema: vi.fn().mockReturnThis(), from: vi.fn((table) => ({
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis(),
      maybeSingle: table === "user_invitations"
        ? vi.fn().mockResolvedValue({ data: invitation, error: null })
        : privileged ? campusQuery : vi.fn().mockResolvedValue({ data: null, error: null }),
    })) });
    vi.mocked(createClient).mockResolvedValue(client(false) as never);
    vi.mocked(createAdminClient).mockReturnValue(client(true) as never);
  });

  it("displays the invited institution without granting anonymous institution access", async () => {
    const result = await verifyInvitation(invitation.token, invitation.user.email);
    expect(result.invitation?.institutionName).toBe("Hynox QA Campus");
  });

  it("checks the email before looking up private institution details", async () => {
    expect((await verifyInvitation(invitation.token, "other@example.com")).valid).toBe(false);
    expect(campusQuery).not.toHaveBeenCalled();
  });

  it.each(["revoked", "accepted"])("does not reveal institution details for a %s invitation", async (status) => {
    invitation.status = status;
    expect((await verifyInvitation(invitation.token, invitation.user.email)).valid).toBe(false);
    expect(campusQuery).not.toHaveBeenCalled();
  });

  it("rejects expired invitations before looking up institution details", async () => {
    invitation.expires_at = "2020-01-01";
    expect((await verifyInvitation(invitation.token, invitation.user.email)).error).toMatch(/expired/);
    expect(campusQuery).not.toHaveBeenCalled();
  });
});
