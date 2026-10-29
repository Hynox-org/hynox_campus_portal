import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("./academic", () => ({ getSessionTenant: vi.fn() }));
import { createClient } from "@/utils/supabase/server";
import { getSessionTenant } from "./academic";
import * as library from "./library";

const id = "04000000-0000-4000-8000-000000000001";
describe("blueprint service boundaries", () => {
  const query = { insert: vi.fn(), update: vi.fn(), eq: vi.fn(), is: vi.fn(), select: vi.fn(), single: vi.fn() };
  beforeEach(() => {
    vi.clearAllMocks();
    for (const method of [query.insert, query.update, query.eq, query.is, query.select]) method.mockReturnValue(query);
    query.single.mockResolvedValue({ data: { id }, error: null });
    vi.mocked(createClient).mockResolvedValue({ schema: () => ({ from: () => query }) } as never);
    vi.mocked(getSessionTenant).mockResolvedValue({ userId: id, tenantId: null, roles: ["super_admin"] });
  });
  it("rejects malformed input before querying", async () => {
    await expect(library.createCourseTemplate({ title: " ", slug: "valid" })).rejects.toThrow("Invalid title");
    expect(query.insert).not.toHaveBeenCalled();
  });
  it("preserves an explicitly zero lesson duration", async () => {
    await library.createLessonTemplate({ module_template_id: id, title: "Zero", duration: 0 });
    expect(query.insert).toHaveBeenCalledWith(expect.objectContaining({ duration: 0 }));
  });
  it("clears an edited video URL", async () => {
    await library.updateLessonTemplate(id, { video_url: "" });
    expect(query.update).toHaveBeenCalledWith(expect.objectContaining({ video_url: "" }));
  });
  it.each([null, { userId: id, tenantId: id, roles: ["student"] }, { userId: id, tenantId: id, roles: ["institution_admin"] }])("denies resource deletion without super admin: %j", async session => {
    vi.mocked(getSessionTenant).mockResolvedValue(session);
    await expect(library.deleteResourceTemplate(id)).rejects.toThrow("Access denied");
    expect(query.update).not.toHaveBeenCalled();
  });
  it("reports missing/already deleted rows instead of success", async () => {
    query.single.mockResolvedValue({ data: null, error: new Error("No row") });
    await expect(library.deleteModuleTemplate(id)).rejects.toThrow("No row");
    expect(query.is).toHaveBeenCalledWith("deleted_at", null);
  });
  it("normalizes valid fields and preserves unpublished false", async () => {
    await library.createCourseTemplate({ title: " Course ", slug: "course", is_published: false });
    expect(query.insert).toHaveBeenCalledWith(expect.objectContaining({ title: "Course", is_published: false }));
  });
  it("propagates database errors", async () => {
    query.single.mockResolvedValue({ data: null, error: new Error("Database unavailable") });
    await expect(library.updateCourseTemplate(id, { is_published: true })).rejects.toThrow("Database unavailable");
  });
});
