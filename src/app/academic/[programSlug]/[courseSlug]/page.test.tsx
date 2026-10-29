import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/services/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/services/academic", () => ({ getProgramBySlug: vi.fn(), getCourseBySlug: vi.fn(), getCourseInstructors: vi.fn(), listTenantInstructors: vi.fn(), listModules: vi.fn(), getAcademicLookups: vi.fn() }));
vi.mock("@/services/library", () => ({ getCourseTemplateMetadata: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("./course-space-console", () => ({ default: () => null }));
import { getCurrentUser } from "@/services/auth";
import * as academic from "@/services/academic";
import CoursePage from "./page";
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue({ tenantId: "campus", primaryRole: "student" } as never);
  vi.mocked(academic.getProgramBySlug).mockResolvedValue({ id: "program", title: "Program" });
  vi.mocked(academic.getCourseBySlug).mockResolvedValue({ id: "course", program_id: "program", title: "Course" });
  vi.mocked(academic.getCourseInstructors).mockResolvedValue([]);
  vi.mocked(academic.listTenantInstructors).mockResolvedValue([]);
  vi.mocked(academic.listModules).mockResolvedValue([]);
  vi.mocked(academic.getAcademicLookups).mockResolvedValue({ courseTypes: [], lessonTypes: [], statuses: [], visibilityTypes: [] });
});
const params = () => Promise.resolve({ programSlug: "program", courseSlug: "course" });
it("rejects a course URL paired with a different program before fetching curriculum", async () => {
  vi.mocked(academic.getCourseBySlug).mockResolvedValue({ id: "course", program_id: "other-program" });
  await expect(CoursePage({ params: params() })).rejects.toThrow("redirect:/academic/program");
  expect(academic.listModules).not.toHaveBeenCalled();
});
it("loads the matched course and its independent supporting data", async () => {
  expect(await CoursePage({ params: params() })).toBeTruthy();
  expect(academic.listModules).toHaveBeenCalledExactlyOnceWith("course");
  expect(academic.getCourseInstructors).toHaveBeenCalledExactlyOnceWith("course");
});
