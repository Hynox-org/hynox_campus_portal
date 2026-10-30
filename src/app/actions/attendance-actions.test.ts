import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getCurrentUser } from "@/services/auth";
import { saveAttendanceForDate, verifyAttendanceMarkingPermission } from "@/services/attendance";
import { bulkMarkAttendanceAction } from "./attendance-actions";
vi.mock("@/services/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/services/attendance", () => ({ verifyAttendanceMarkingPermission: vi.fn(), saveAttendanceForDate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-29T19:00:00Z"));
  vi.mocked(getCurrentUser).mockResolvedValue({ user: { id: "teacher" }, primaryRole: "teacher" } as never);
  vi.mocked(verifyAttendanceMarkingPermission).mockResolvedValue(true);
});
afterEach(() => vi.useRealTimers());
it("uses the campus day rather than the UTC deployment clock for Teacher edits", async () => {
  expect(await bulkMarkAttendanceAction("cohort", "2026-10-30", ["student"], "present")).toEqual({ success: true });
  expect(saveAttendanceForDate).toHaveBeenCalledTimes(1);
  expect(await bulkMarkAttendanceAction("cohort", "2026-10-29", ["student"], "present")).toMatchObject({ error: expect.stringContaining("present day") });
  expect(saveAttendanceForDate).toHaveBeenCalledTimes(1);
});
it("returns a structured validation failure if access verification rejects malformed input", async () => {
  vi.mocked(verifyAttendanceMarkingPermission).mockRejectedValue(new Error("Invalid ID"));
  expect(await bulkMarkAttendanceAction("bad", "2026-10-30", [], "present")).toEqual({ error: "Invalid ID" });
  expect(saveAttendanceForDate).not.toHaveBeenCalled();
});
