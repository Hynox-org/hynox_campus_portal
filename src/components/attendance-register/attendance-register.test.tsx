// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getAttendanceRegisterAction, setAttendanceStatusAction, bulkMarkAttendanceAction } from "@/app/actions/attendance-actions";
import AttendanceRegister from "./attendance-register";
vi.mock("@/app/actions/attendance-actions", () => ({ getAttendanceRegisterAction: vi.fn(), setAttendanceStatusAction: vi.fn(), bulkMarkAttendanceAction: vi.fn() }));
vi.mock("@/components/toast", () => ({ useToast: () => ({ showError: vi.fn(), showSuccess: vi.fn() }) }));
const register = {
  cohort: { id: "cohort", name: "QA", code: "QA", start_date: "2026-10-01", end_date: "2026-11-30" },
  students: Array.from({ length: 101 }, (_, i) => ({ id: `s${i}`, full_name: `Student ${String(i).padStart(3, "0")}`, email: `${i}@example.com` })),
  dates: Array.from({ length: 61 }, (_, i) => ({ date: new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10), isSunday: false, isHoliday: false, sessionId: null, holidayName: null })), records: {},
};
beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-30T06:00:00Z")); vi.mocked(getAttendanceRegisterAction).mockResolvedValue({ success: true, register }); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
function mount() { render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AttendanceRegister cohortId="cohort" cohortName="QA" userRole="super_admin" /></QueryClientProvider>); }
it("bounds the sheet to 50 students and one month while keeping the next roster page available", async () => {
  mount(); await screen.findByText("Student 000");
  expect(screen.queryByText("Student 050")).toBeNull();
  expect(document.querySelectorAll("th").length).toBeLessThanOrEqual(33);
  fireEvent.click(screen.getByText("Next students"));
  expect(screen.getByText("Student 050")).toBeTruthy();
  expect(screen.queryByText("Student 000")).toBeNull();
  expect(screen.getByText("Students 51-100 of 101")).toBeTruthy();
});
it("shows a recoverable read error and reloads the same cohort on Retry", async () => {
  vi.mocked(getAttendanceRegisterAction).mockResolvedValueOnce({ error: "Temporary database failure" });
  mount(); fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
  expect(await screen.findByText("Student 000")).toBeTruthy();
  expect(getAttendanceRegisterAction).toHaveBeenCalledTimes(2);
});
it("rolls back an optimistic mark when both the save and recovery read lose connectivity", async () => {
  vi.mocked(setAttendanceStatusAction).mockRejectedValue(new Error("Offline"));
  mount(); await screen.findByText("Student 000");
  fireEvent.click(screen.getByText("Day"));
  vi.mocked(getAttendanceRegisterAction).mockResolvedValue({ error: "Offline" });
  fireEvent.click(screen.getByLabelText("Student 000: Present"));
  await screen.findByText("Student 000");
  await vi.waitFor(() => expect(screen.getByLabelText("Student 000: Present").getAttribute("aria-pressed")).toBe("false"));
});
it("excludes students who had not joined from bulk marks on an earlier date", async () => {
  vi.mocked(getAttendanceRegisterAction).mockResolvedValue({ success: true, register: { ...register, students: [
    { ...register.students[0], enrolled_date: "2026-01-01" }, { ...register.students[1], enrolled_date: "2026-11-01" },
  ] } });
  vi.mocked(bulkMarkAttendanceAction).mockResolvedValue({ success: true });
  mount(); await screen.findByText("Student 000"); fireEvent.click(screen.getByText("Day"));
  expect(screen.getByLabelText("Student 001: Present").hasAttribute("disabled")).toBe(true);
  fireEvent.click(screen.getByText("Mark All Present"));
  await vi.waitFor(() => expect(bulkMarkAttendanceAction).toHaveBeenCalledWith("cohort", "2026-10-30", ["s0"], "present"));
});

