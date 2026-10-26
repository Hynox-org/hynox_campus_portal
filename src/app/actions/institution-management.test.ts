import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/services/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { getCurrentUser } from "@/services/auth";
import { createClient } from "@/utils/supabase/server";
import { deleteUserAction, listTeacherInstitutionsAction } from "./institution-actions";
const own = "11111111-1111-4111-8111-111111111111";
const target = "22222222-2222-4222-8222-222222222222";
const rpc = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue({ user: { id: own }, primaryRole: "super_admin" } as never);
  vi.mocked(createClient).mockResolvedValue({ schema: () => ({ rpc }) } as never);
  rpc.mockResolvedValue({ data: { deleted: true }, error: null });
});
it("does not invoke deletion for another role, a malformed ID, or self", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue({ user: { id: own }, primaryRole: "institution_admin" } as never);
  expect((await deleteUserAction(target)).error).toBe("Access denied.");
  vi.mocked(getCurrentUser).mockResolvedValue({ user: { id: own }, primaryRole: "super_admin" } as never);
  expect((await deleteUserAction("bad")).error).toBeTruthy();
  expect((await deleteUserAction(own)).error).toMatch(/own account/);
  expect(rpc).not.toHaveBeenCalled();
});
it("deletes through one guarded database operation", async () => {
  expect((await deleteUserAction(target)).success).toBe(true);
  expect(rpc).toHaveBeenCalledWith("delete_managed_user", { target_user_id: target });
});
it("reports a database refusal without claiming deletion", async () => {
  rpc.mockResolvedValue({ data: null, error: { message: "protected" } });
  expect((await deleteUserAction(target)).success).toBeUndefined();
});
it("does not reveal another teacher's campus mappings", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue({ user: { id: own }, primaryRole: "teacher" } as never);
  expect((await listTeacherInstitutionsAction(target)).error).toBe("Access denied.");
  expect(rpc).not.toHaveBeenCalled();
});
