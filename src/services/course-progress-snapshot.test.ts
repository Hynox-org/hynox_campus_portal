import { expect, it, vi } from "vitest";
import { parseProgressSnapshot, readProgressSnapshots, setLessonProgress } from "./course-progress";
import { createClient } from "@/utils/supabase/server";
vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));

const valid = { user_id: "student", course_id: "course", completed_lessons: 1, total_lessons: 2,
  completed_activities: 1, total_activities: 1, progress_percentage: 66.67, status_code: "in_progress" };
it("checks lessons and activities together and preserves the exact completion state", () => {
  expect(parseProgressSnapshot(valid).progress_percentage).toBe(66.67);
  expect(parseProgressSnapshot({ ...valid, completed_lessons: 2, progress_percentage: 100, status_code: "completed" }).status_code).toBe("completed");
});
it.each([null, [], {}, { ...valid, total_activities: undefined }, { ...valid, completed_lessons: -1 },
  { ...valid, completed_activities: 2 }, { ...valid, progress_percentage: NaN }, { ...valid, progress_percentage: 100 },
  { ...valid, status_code: "completed" }, { ...valid, status_code: "unknown" }, { ...valid, total_lessons: "2" }])("rejects malformed or inconsistent progress rather than showing false completion %#", value => {
  expect(() => parseProgressSnapshot(value)).toThrow(/course progress response/);
});
it("does not display a rounded 100 percent when one required item remains", () => {
  const nearComplete = { ...valid, completed_lessons: 99999, total_lessons: 100000, completed_activities: 0,
    total_activities: 0, progress_percentage: 99.99, status_code: "in_progress" };
  expect(parseProgressSnapshot(nearComplete).status_code).toBe("in_progress");
  expect(() => parseProgressSnapshot({ ...nearComplete, status_code: "completed" })).toThrow(/Inconsistent/);
  expect(() => parseProgressSnapshot({ ...nearComplete, progress_percentage: 100 })).toThrow(/Inconsistent/);
});
it("keeps an empty course at zero instead of marking it complete", () => {
  expect(parseProgressSnapshot({ ...valid, completed_lessons: 0, total_lessons: 0, completed_activities: 0,
    total_activities: 0, progress_percentage: 0, status_code: "not_started" }).progress_percentage).toBe(0);
});

it("deduplicates and bounds large dashboard reads to four concurrent requests", async () => {
  let active = 0;
  let peak = 0;
  const rpc = vi.fn(async (_name: string, args: { p_student_ids: string[]; p_course_ids: string[] }) => {
    expect(args.p_student_ids.length).toBeLessThanOrEqual(50);
    expect(args.p_course_ids.length).toBeLessThanOrEqual(100);
    active++;
    peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 1));
    active--;
    return { data: [], error: null };
  });
  vi.mocked(createClient).mockResolvedValue({ schema: () => ({ rpc }) } as never);
  const students = Array.from({ length: 101 }, (_, index) => `student-${index}`);
  const courses = Array.from({ length: 201 }, (_, index) => `course-${index}`);
  await readProgressSnapshots([...students, students[0]], [...courses, courses[0]]);
  expect(rpc).toHaveBeenCalledTimes(9);
  expect(peak).toBe(4);
});

it("does no database work for an empty dashboard selection", async () => {
  vi.mocked(createClient).mockClear();
  expect(await readProgressSnapshots([], ["course"])).toEqual([]);
  expect(createClient).not.toHaveBeenCalled();
});

it("propagates an atomic lesson write failure instead of returning success", async () => {
  const rpc = vi.fn().mockResolvedValue({ data: null, error: new Error("Lesson is unavailable") });
  vi.mocked(createClient).mockResolvedValue({ schema: () => ({ rpc }) } as never);
  await expect(setLessonProgress("student", "lesson", "course", true)).rejects.toThrow("Lesson is unavailable");
  expect(rpc).toHaveBeenCalledTimes(1);
});
