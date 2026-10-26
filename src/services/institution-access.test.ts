import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/services/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/services/institution", () => ({ listTeacherInstitutions: vi.fn() }));
import { getCurrentUser } from "@/services/auth";
import { listTeacherInstitutions } from "@/services/institution";
import { requireInstitutionAccess } from "./institution-access";
const campus = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue({ user: { id: "user" }, primaryRole: "student", tenantId: campus, institution: { status: "active" } } as never);
  vi.mocked(listTeacherInstitutions).mockResolvedValue([{ id: campus, status: "active" }] as never);
});
it("rejects malformed IDs before querying identity", async () => {
  await expect(requireInstitutionAccess("bad")).rejects.toThrow();
  expect(getCurrentUser).not.toHaveBeenCalled();
});
it("rejects signed-out callers", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(null);
  await expect(requireInstitutionAccess(campus)).rejects.toThrow("Access denied");
});
it("allows students only their own academic context", async () => {
  await expect(requireInstitutionAccess(campus)).resolves.toMatchObject({ primaryRole: "student" });
  await expect(requireInstitutionAccess(other)).rejects.toThrow("Access denied");
  await expect(requireInstitutionAccess(campus, true)).rejects.toThrow("Access denied");
});
it.each(["public", "mentor"])("denies unsupported role %s", async primaryRole => {
  vi.mocked(getCurrentUser).mockResolvedValue({ user: { id: "user" }, primaryRole, tenantId: campus } as never);
  await expect(requireInstitutionAccess(campus)).rejects.toThrow("Access denied");
});
it.each(["inactive", "suspended"])("blocks %s campus access", async status => {
  vi.mocked(getCurrentUser).mockResolvedValue({ user: { id: "user" }, primaryRole: "institution_admin", tenantId: campus, institution: { status } } as never);
  await expect(requireInstitutionAccess(campus, true)).rejects.toThrow("Access denied");
});
it.each(["teacher", "trainer"])("uses stored campus mappings for %s", async primaryRole => {
  vi.mocked(getCurrentUser).mockResolvedValue({ user: { id: "teacher" }, primaryRole } as never);
  await expect(requireInstitutionAccess(campus, true)).resolves.toBeTruthy();
  expect(listTeacherInstitutions).toHaveBeenCalledWith("teacher", false);
  await expect(requireInstitutionAccess(other, true)).rejects.toThrow("Access denied");
});
it("allows normal super administrators to select another campus", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue({ user: { id: "admin" }, primaryRole: "super_admin" } as never);
  await expect(requireInstitutionAccess(other, true)).resolves.toBeTruthy();
});
