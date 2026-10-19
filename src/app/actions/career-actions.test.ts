import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/services/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));
import { getCurrentUser } from "@/services/auth";
import { createClient } from "@/utils/supabase/server";
import { saveResumeAction, scanResumeAction, deleteResumeAction } from "./career-actions";
import { emptyResume } from "@/lib/resume";

const docId = "10000000-0000-4000-8000-000000000001";
const query = { insert: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis(), delete: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn(), single: vi.fn() };
const db = { from: vi.fn(() => query) };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue({ user: { id: "business-student", status: "active" }, authUser: { id: "different-auth-id" }, primaryRole: "student", tenantId: "campus" } as never);
  vi.mocked(createClient).mockResolvedValue({ schema: vi.fn(() => db) } as never);
  query.maybeSingle.mockResolvedValue({ data: { id: docId, version: 2 }, error: null });
  query.single.mockResolvedValue({ data: { id: "scan" }, error: null });
});
describe("student career actions", () => {
  it("rejects non-students before accessing documents", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ user: { status: "active" }, primaryRole: "teacher" } as never);
    expect((await deleteResumeAction(docId)).error).toContain("student account"); expect(createClient).not.toHaveBeenCalled();
  });
  it("uses business identity and institution from the session on insert", async () => {
    await saveResumeAction({ id: docId, version: 0, title: "Resume", template: "classic", content: emptyResume() });
    expect(query.insert).toHaveBeenCalledWith(expect.objectContaining({ student_id: "business-student", tenant_id: "campus", version: 1 }));
  });
  it("reports save conflicts without overwriting the other version", async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: null });
    const result = await saveResumeAction({ id: docId, version: 3, title: "Resume", template: "classic", content: emptyResume() });
    expect(query.eq).toHaveBeenCalledWith("version", 3); expect(query.eq).toHaveBeenCalledWith("student_id", "business-student"); expect(result.error).toContain("another tab");
  });
  it("computes reports server-side and never stores raw text or the job description", async () => {
    await scanResumeAction({ text: "Skills\nSQL Python\nEducation\n2026\nProjects\nBuilt a project", job: "Requires SQL", label: "QA", pages: null, source: "text" });
    const written = query.insert.mock.calls[0][0];
    expect(written.report.match).toBe(100); expect(written.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(written).not.toHaveProperty("text"); expect(written).not.toHaveProperty("job");
  });
  it("loads the owner's saved content instead of trusting supplied builder text", async () => {
    const content = emptyResume(); content.basics.summary = "Python";
    query.maybeSingle.mockResolvedValue({ data: { content, version: 4 }, error: null });
    await scanResumeAction({ resumeId: docId, text: "JavaScript", job: "Requires Python", label: "QA", pages: null, source: "builder" });
    expect(query.eq).toHaveBeenCalledWith("student_id", "business-student");
    expect(query.insert).toHaveBeenCalledWith(expect.objectContaining({ resume_version: 4, report: expect.objectContaining({ matched: ["Python"] }) }));
  });
});
