import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/services/institution-access", () => ({ requireInstitutionAccess: vi.fn() }));
vi.mock("@/services/academic-access", () => ({ assignedCourseIds: vi.fn() }));
vi.mock("@/services/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/services/academic", () => ({ listPrograms: vi.fn(), listTenantCourses: vi.fn(), listModules: vi.fn(), listLessons: vi.fn() }));
vi.mock("@/services/delivery", () => ({ listCohorts: vi.fn(), listEnrollments: vi.fn(), listCourseAssignments: vi.fn() }));
vi.mock("@/services/learning", () => ({ listAllActivities: vi.fn(), listProjectSubmissions: vi.fn(), listChallengeSubmissions: vi.fn() }));
vi.mock("@/app/actions/learning-actions", () => ({ listQuizAttemptsAction: vi.fn() }));
vi.mock("@/services/institution", () => ({ listInstitutionUsers: vi.fn(), listInstitutions: vi.fn() }));
vi.mock("@/services/onboarding", () => ({ listOnboardingInvitations: vi.fn() }));
vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));
import { requireInstitutionAccess } from "@/services/institution-access";
import { assignedCourseIds } from "@/services/academic-access";
import { createClient } from "@/utils/supabase/server";
import * as academic from "@/services/academic";
import * as delivery from "@/services/delivery";
import { getInstitutionPrefetchDataAction, getDeliveryPrefetchDataAction } from "./prefetch-actions";
const campus = "11111111-1111-4111-8111-111111111111";
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(assignedCourseIds).mockResolvedValue(new Set(["course-a"]));
  vi.mocked(requireInstitutionAccess).mockResolvedValue({ user: { id: "student-1" }, primaryRole: "student" } as never);
  vi.mocked(academic.listPrograms).mockResolvedValue([{ id: "program-a", status: { code: "active" } }, { id: "program-b", status: { code: "active" } }] as never);
  vi.mocked(academic.listTenantCourses).mockResolvedValue([
    { id: "course-a", program_id: "program-a", status: { code: "active" } }, { id: "course-b", program_id: "program-b", status: { code: "active" } }
  ] as never);
  vi.mocked(academic.listModules).mockResolvedValue([{ id: "module-a", course_id: "course-a", status: { code: "active" } }] as never);
  vi.mocked(academic.listLessons).mockResolvedValue([{ id: "lesson-a", module_id: "module-a", status: { code: "active" } }] as never);
  const from = vi.fn((table: string) => {
    const result = table === "enrollments" ? [{ cohort_id: "cohort-a" }] : [{ course_id: "course-a", status: { code: "active" } }];
    const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(), then: (resolve: (value: unknown) => void) => resolve({ data: result, error: null }) };
    return query;
  });
  vi.mocked(createClient).mockResolvedValue({ schema: () => ({ from }) } as never);
});
it("returns only enrolled and assigned curriculum to a student", async () => {
  const result = await getInstitutionPrefetchDataAction(campus);
  expect(result).toMatchObject({ success: true, programs: [{ id: "program-a", status: { code: "active" } }], courses: [{ id: "course-a" }], modules: [{ id: "module-a" }], lessons: [{ id: "lesson-a" }] });
  expect(academic.listModules).toHaveBeenCalledOnce();
  expect(academic.listModules).toHaveBeenCalledWith("course-a");
});
it("does not return delivery data to students", async () => {
  vi.mocked(requireInstitutionAccess).mockRejectedValue(new Error("Access denied."));
  expect((await getDeliveryPrefetchDataAction(campus)).error).toBe("Access denied.");
  expect(delivery.listCohorts).not.toHaveBeenCalled();
});
