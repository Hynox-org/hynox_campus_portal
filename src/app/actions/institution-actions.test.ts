import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/utils/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/services/institution", () => ({}));
vi.mock("@/utils/email", () => ({ sendOnboardingEmail: vi.fn() }));
vi.mock("@/services/onboarding", async () => ({
  ...await import("../../services/onboarding"),
  processCsvOnboarding: vi.fn(), onboardSingleUser: vi.fn(),
}));

import { getCurrentUser } from "@/services/auth";
import { createClient } from "@/utils/supabase/server";
import { processCsvOnboarding, onboardSingleUser } from "@/services/onboarding";
import { onboardSingleUserAction, uploadCsvOnboardingAction } from "./institution-actions";

describe("onboarding authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue({ primaryRole: "institution_admin", tenantId: "campus-1", user: { id: "admin-1" } } as never);
    const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) };
    vi.mocked(createClient).mockResolvedValue({ schema: () => ({ from: () => query }) } as never);
    vi.mocked(processCsvOnboarding).mockResolvedValue([]);
  });

  it.each(["super_admin", "institution_admin", "teacher"])("rejects an institution admin's bulk %s role before provisioning", async (role) => {
    const result = await uploadCsvOnboardingAction("campus-1", `name,email,role\nMember,member@example.com,${role}`);
    expect(result.error).toBeTruthy();
    expect(processCsvOnboarding).not.toHaveBeenCalled();
  });
  it("rejects a tenant override anywhere in a batch before changing the first row", async () => {
    const result = await uploadCsvOnboardingAction("campus-1", "name,email,institution_id\nOne,one@example.com,campus-1\nTwo,two@example.com,campus-2");
    expect(result.error).toMatch(/own institution/);
    expect(processCsvOnboarding).not.toHaveBeenCalled();
  });
  it("allows student onboarding in the administrator's own institution", async () => {
    expect((await uploadCsvOnboardingAction("campus-1", "name,email\nStudent,student@example.com")).success).toBe(true);
    expect(processCsvOnboarding).toHaveBeenCalledOnce();
  });
  it("rejects single-user privileged role escalation", async () => {
    expect((await onboardSingleUserAction({ name: "Member", email: "member@example.com", role: "super_admin", institutionId: "campus-1" })).error).toBeTruthy();
    expect(onboardSingleUser).not.toHaveBeenCalled();
  });
  it("requires the dedicated super-admin flow even for a super administrator", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ primaryRole: "super_admin", user: { id: "admin-1" } } as never);
    expect((await uploadCsvOnboardingAction("campus-1", "name,email,role\nMember,member@example.com,super_admin")).error).toBeTruthy();
    expect(processCsvOnboarding).not.toHaveBeenCalled();
  });
  it.each([null, { email: ["student@example.com"], name: "Student", role: "student" }, { email: "student@example.com", name: {}, role: "student" }])("rejects malformed server-action input %o", async input => {
    expect((await onboardSingleUserAction(input as never)).error).toMatch(/Invalid/);
    expect(onboardSingleUser).not.toHaveBeenCalled();
  });
  it("rejects protected writes when the shared browser session has ended",async()=>{
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    expect((await uploadCsvOnboardingAction("campus-1","name,email\nStudent,student@example.com")).error).toBe("Access denied.");
    expect((await onboardSingleUserAction({name:"Student",email:"student@example.com",role:"student",institutionId:"campus-1"})).error).toBe("Access denied.");
    expect(processCsvOnboarding).not.toHaveBeenCalled();expect(onboardSingleUser).not.toHaveBeenCalled();
  });
});
