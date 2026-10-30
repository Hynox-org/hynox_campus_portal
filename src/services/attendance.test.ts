import { beforeEach, expect, it, vi } from "vitest";
import { createClient } from "@/utils/supabase/server";
import { saveAttendanceForDate, getCohortAttendanceRegister, verifyAttendanceMarkingPermission } from "./attendance";
vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));
const cohort = "11111111-1111-4111-8111-111111111111", student = "22222222-2222-4222-8222-222222222222";
const rpc = vi.fn();
beforeEach(() => { vi.clearAllMocks(); rpc.mockResolvedValue({ data: { saved: 1 }, error: null }); vi.mocked(createClient).mockResolvedValue({ schema: () => ({ rpc }) } as never); });
it("saves a batch in one RPC without per-student request loops", async () => {
  await saveAttendanceForDate(cohort, "2026-10-30", [{ student_id: student, status: "present" }], student);
  expect(rpc).toHaveBeenCalledExactlyOnceWith("save_attendance", expect.objectContaining({ p_cohort: cohort, p_date: "2026-10-30", p_records: [{ student_id: student, status: "present" }] }));
});
it("rejects duplicate marks before contacting Supabase", async () => {
  await expect(saveAttendanceForDate(cohort, "2026-10-30", [{ student_id: student, status: "present" }, { student_id: student, status: "absent" }], student)).rejects.toThrow("Duplicate");
  expect(rpc).not.toHaveBeenCalled();
});
it("propagates read failures instead of returning an empty register", async () => {
  rpc.mockResolvedValue({ error: new Error("offline"), data: null });
  await expect(getCohortAttendanceRegister(cohort)).rejects.toThrow("offline");
});
it("does not authorize an unassigned Teacher through a home-campus fallback", async () => {
  rpc.mockResolvedValue({ data: false, error: null });
  expect(await verifyAttendanceMarkingPermission(cohort, student, "teacher")).toBe(false);
  expect(rpc).toHaveBeenCalledExactlyOnceWith("can_mark_attendance", { p_cohort: cohort, p_actor: student });
});
it("rejects a malformed response and validates scoped student identifiers", async () => {
  await expect(getCohortAttendanceRegister(cohort)).rejects.toThrow("not confirmed");
  await expect(getCohortAttendanceRegister(cohort, "bad")).rejects.toThrow("Invalid");
});
