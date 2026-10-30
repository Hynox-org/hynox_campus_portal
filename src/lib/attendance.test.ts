import { afterEach, expect, it, vi } from "vitest";
import { attendanceToday, attendancePercentage, summarizeAttendance, validateAttendanceDate } from "./attendance";
afterEach(() => vi.useRealTimers());
it("uses the campus date across a UTC midnight boundary", () => {
  expect(attendanceToday(new Date("2026-10-29T19:00:00Z"))).toBe("2026-10-30");
  expect(attendanceToday(new Date("2026-10-29T18:00:00Z"))).toBe("2026-10-29");
});
it.each(["2026-02-30", "2026-13-01", "2026-1-2", "", "not-a-date"])("rejects malformed calendar date %s", date => expect(() => validateAttendanceDate(date)).toThrow());
it("does not invent perfect attendance when no day is marked", () => {
  expect(attendancePercentage(0, 0, 0)).toBe(0);
  expect(attendancePercentage(1, 1, 1)).toBe(66.7);
});
it("excludes holidays, future dates and pre-enrollment days from each student", () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-30T06:00:00Z"));
  const dates = ["27", "28", "29", "30", "31"].map(day => ({ date: `2026-10-${day}`, isHoliday: day === "29", isSunday: false, holidayName: null, sessionId: null }));
  const stats = summarizeAttendance({ cohort: { id: "c", code: "C", name: "C", start_date: "2026-10-27", end_date: "2026-10-31" }, dates,
    students: [{ id: "s", full_name: "S", email: "s@example.com", enrolled_date: "2026-10-28" }], records: { s: { "2026-10-27": "present", "2026-10-28": "late", "2026-10-29": "present", "2026-10-30": "absent", "2026-10-31": "present" } } });
  expect(stats.students[0]).toMatchObject({ present: 0, late: 1, absent: 1, workingDays: 2, percentage: 50 });
  expect(stats).toMatchObject({ workingDays: 3, holidays: 1, totalDays: 4 });
});
