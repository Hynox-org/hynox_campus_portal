import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("./auth", () => ({ getCurrentUser: vi.fn() }));
import { createClient } from "@/utils/supabase/server";
import { getCurrentUser } from "./auth";
import { getStudentDeliveryData } from "./delivery";
const userId = "11111111-1111-4111-8111-111111111111";
const reads: string[] = [];
const write = vi.fn();
beforeEach(() => {
  reads.length = 0; vi.clearAllMocks();
  vi.mocked(getCurrentUser).mockResolvedValue({ user: { id: userId }, primaryRole: "student" } as never);
  vi.mocked(createClient).mockResolvedValue({ schema: () => ({ rpc: async () => {
    reads.push("course_progress_snapshot");
    return { data: [{ user_id: userId, course_id: "course", completed_lessons: 42, total_lessons: 100,
      completed_activities: 0, total_activities: 0, progress_percentage: 42, status_code: "in_progress" }], error: null };
  }, from: (table: string) => {
    const rows: Record<string, unknown[]> = {
      enrollments: Array.from({ length: 30 }, (_, id) => ({ cohort: { id: `cohort-${id}`, program_id: "program", name: "Group", code: "QA" } })),
      programs: [{ id: "program", title: "Program", status: { code: "active" } }],
      course_assignments: Array.from({ length: 30 }, (_, id) => ({ cohort_id: `cohort-${id}`, course_id: id ? "course" : "private", is_required: true })),
      courses: [{ id: "course", program_id: "program", title: "Shared course", status: { code: "active" } },
        { id: "private", program_id: "program", title: "Private course", status: { code: "active" }, visibility: { code: "private" } }],
      course_progress: [{ course_id: "course", progress_percentage: 42 }],
    };
    const query = { select: () => query, eq: () => query, is: () => query, in: () => query, insert: write, update: write, upsert: write,
      then: (resolve: (value: unknown) => void) => { reads.push(table); return resolve({ data: rows[table] || [], error: null }); } };
    return query;
  } }) } as never);
});
it("loads thirty cohorts in five batched reads with one read-only progress calculation", async () => {
  const result = await getStudentDeliveryData(userId);
  expect(reads).toHaveLength(5);
  expect(write).not.toHaveBeenCalled();
  expect(result[0].cohorts).toHaveLength(30);
  expect(result[0].courses).toHaveLength(29);
  expect(result[0].courses[0].progress.progress_percentage).toBe(42);
});
it("rejects signed-out callers before reading delivery data", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(null);
  await expect(getStudentDeliveryData(userId)).rejects.toThrow("Access denied");
  expect(reads).toHaveLength(0);
});
