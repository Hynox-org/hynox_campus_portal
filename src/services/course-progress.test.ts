import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("./academic-access", () => ({ requireStudentRead: vi.fn(async () => ({ user: { id: "11111111-1111-4111-8111-111111111111" } })) }));
import { createClient } from "@/utils/supabase/server";
import { syncCourseProgress } from "./delivery";

const student = "11111111-1111-4111-8111-111111111111";
const course = "22222222-2222-4222-8222-222222222222";
const snapshot = { user_id: student, course_id: course, completed_lessons: 1, total_lessons: 1,
  completed_activities: 0, total_activities: 1, progress_percentage: 50, status_code: "in_progress" };
const rpc = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({ data: snapshot, error: null });
  vi.mocked(createClient).mockResolvedValue({ schema: () => ({ rpc, from: (table: string) => {
    let saved: object | undefined;
    const rows: Record<string, unknown[]> = { modules: [{ id: "module" }],
      lessons: [{ id: "lesson", lesson_type: { code: "text" } }],
      lesson_progress: [{ id: "progress", status_code: "completed" }] };
    const query = { select: () => query, eq: () => query, is: () => query, in: () => query,
      upsert: (input: object) => { saved = input; return query; },
      maybeSingle: async () => ({ data: null, error: { message: "Multiple enrollments" } }),
      single: async () => ({ data: saved, error: null }),
      then: (resolve: (value: unknown) => void) => resolve({ data: rows[table] || [], error: null }) };
    return query;
  } }) } as never);
});

it("includes a required course activity when a student has multiple program enrollments", async () => {
  const result = await syncCourseProgress(student, course);
  expect(result.progress_percentage).toBe(50);
  expect(result.status_code).toBe("in_progress");
});

it("does not report successful recalculation when the authoritative read fails", async () => {
  rpc.mockResolvedValue({ data: null, error: new Error("Progress calculation unavailable") });
  await expect(syncCourseProgress(student, course)).rejects.toThrow("Progress calculation unavailable");
});
