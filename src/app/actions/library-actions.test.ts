import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@/services/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/services/library", () => ({
  listCourseTemplates: vi.fn(), createCourseTemplate: vi.fn(), updateCourseTemplate: vi.fn(), deleteCourseTemplate: vi.fn(),
  listModuleTemplates: vi.fn(), createModuleTemplate: vi.fn(), updateModuleTemplate: vi.fn(), deleteModuleTemplate: vi.fn(),
  listLessonTemplates: vi.fn(), createLessonTemplate: vi.fn(), updateLessonTemplate: vi.fn(), deleteLessonTemplate: vi.fn(),
  listResourceTemplates: vi.fn(), createResourceTemplate: vi.fn(), deleteResourceTemplate: vi.fn(), instantiateCourseTemplate: vi.fn(),
}));
import { getCurrentUser } from "@/services/auth";
import * as service from "@/services/library";
import * as actions from "./library-actions";
import { revalidatePath, revalidateTag } from "next/cache";

const attempts = [
  () => actions.listCourseTemplatesAction(), () => actions.createCourseTemplateAction({ title: "Test", slug: "test" }),
  () => actions.updateCourseTemplateAction("id", { is_published: true }), () => actions.deleteCourseTemplateAction("id"),
  () => actions.listModuleTemplatesAction("id"), () => actions.createModuleTemplateAction({ course_template_id: "id", title: "Test" }),
  () => actions.updateModuleTemplateAction("id", { position: 2 }), () => actions.deleteModuleTemplateAction("id"),
  () => actions.listLessonTemplatesAction("id"), () => actions.createLessonTemplateAction({ module_template_id: "id", title: "Test" }),
  () => actions.updateLessonTemplateAction("id", { position: 2 }), () => actions.deleteLessonTemplateAction("id"),
  () => actions.listResourceTemplatesAction("id"), () => actions.createResourceTemplateAction({ lesson_template_id: "id", title: "Test", resource_type: "link" }),
  () => actions.deleteResourceTemplateAction("id"), () => actions.instantiateCourseTemplateAction("a", "b", "c", "d"),
];
describe("blueprint server actions", () => {
  beforeEach(() => vi.clearAllMocks());
  it.each([null, "student", "teacher", "trainer", "institution_admin", "public"])("guards every action for %s", async role => {
    vi.mocked(getCurrentUser).mockResolvedValue(role ? { primaryRole: role } as never : null);
    for (const attempt of attempts) expect(await attempt()).toHaveProperty("error");
    for (const method of Object.values(service)) expect(method).not.toHaveBeenCalled();
  });
  it("invalidates shared template caches when publishing", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ primaryRole: "super_admin" } as never);
    vi.mocked(service.updateCourseTemplate).mockResolvedValue({ id: "id", is_published: true });
    expect(await actions.updateCourseTemplateAction("id", { is_published: true })).toHaveProperty("success", true);
    expect(revalidateTag).toHaveBeenCalledWith("course-templates", "max");
    expect(revalidatePath).toHaveBeenCalledWith("/admin");
  });
  it("returns errors without invalidating caches or claiming success", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ primaryRole: "super_admin" } as never);
    vi.mocked(service.instantiateCourseTemplate).mockRejectedValue(new Error("Already copied"));
    expect(await actions.instantiateCourseTemplateAction("a", "b", "c", "d")).toEqual({ error: "Already copied" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
  it("preserves structured Supabase errors", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ primaryRole: "super_admin" } as never);
    vi.mocked(service.createCourseTemplate).mockRejectedValue({ code: "23505", message: "Duplicate live slug" });
    expect(await actions.createCourseTemplateAction({ title: "Test", slug: "test" })).toEqual({ error: "Duplicate live slug" });
  });
});
