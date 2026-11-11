// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CacheProvider } from "@/components/cache-provider";
import { ToastProvider } from "@/components/toast";
const mocks = vi.hoisted(() => {
  const quiz = { id: "quiz", strict_mode: true, max_attempts: 1, time_limit_minutes: 30 };
  const attempt = { id: "attempt", quiz_id: "quiz", started_at: new Date().toISOString(), attempt_number: 1 };
  const activity = { id: "a", title: "Strict QA", activity_type_code: "quiz", cohort_id: "c", assignment: { cohort_id: "c" }, max_score: 100, progress: { status_code: "assigned", attempt_number: 0 } };
  return { programs: [{ id: "program", title: "QA", cohorts: [{ id: "c", name: "QA", code: "QA" }], courses: [] }], academics: { courses: [], modules: [], lessons: [] }, quiz, attempt, activity, start: vi.fn(), forfeit: vi.fn(), submit: vi.fn(), project: vi.fn() };
});
vi.mock("@/hooks/use-delivery", () => ({ useStudentDeliveryData: () => ({ data: { programs: mocks.programs }, isLoading: false }) }));
vi.mock("@/hooks/use-academics", () => ({ useAcademicPrefetchData: () => ({ data: mocks.academics }) }));
vi.mock("@/app/actions/academic-actions", () => ({}));
vi.mock("@/app/actions/delivery-actions", () => ({ getStudentDeliveryDataAction: async () => ({ programs: mocks.programs }), listStudentLessonProgressAction: async () => ({ progressList: [] }) }));
vi.mock("@/app/actions/attendance-actions", () => ({ getAttendanceRegisterAction: async () => ({}) }));
vi.mock("@/app/actions/learning-actions", () => ({
  getStudentAssignedActivitiesAction: async () => ({ activities: [mocks.activity] }),
  getQuizDetailsAction: async () => ({ quiz: mocks.quiz, questions: [] }),
  getActiveQuizAttemptAction: async () => ({ attempt: null }),
  getQuizSessionDetailsAction: async () => ({ attempt: mocks.attempt, questions: [] }),
  getProjectDetailsAction: mocks.project,
  startQuizAttemptAction: mocks.start, forfeitQuizAttemptAction: mocks.forfeit, submitQuizAnswersAction: mocks.submit,
}));
vi.mock("@/components/sign-out-button", () => ({ default: () => null }));
vi.mock("@/components/dashboard-loader", () => ({ DashboardLoader: () => null }));
import StudentConsole from "./student-console";
let fullscreen: Element | null;
let hidden: boolean;
beforeEach(() => {
  vi.clearAllMocks(); mocks.activity.activity_type_code = "quiz"; fullscreen = null; hidden = false;
  Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => fullscreen });
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  document.documentElement.requestFullscreen = vi.fn(async () => { fullscreen = document.documentElement; });
  document.exitFullscreen = vi.fn(async () => { fullscreen = null; });
  mocks.start.mockResolvedValue({ attempt: mocks.attempt });
  window.history.replaceState(null, "", "/student?tab=quizzes&parentTab=assessments");
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
async function openQuiz() {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><CacheProvider><ToastProvider>
    <StudentConsole studentId="student" studentEmail="s@example.com" fullName="Student" primaryRole="student" institution={{ id: "campus", name: "QA" }} />
  </ToastProvider></CacheProvider></QueryClientProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "Enter Quiz" }));
  return screen.findByRole("button", { name: "Start Quiz Attempt" });
}
it("does not consume an attempt when fullscreen permission is rejected", async () => {
  document.documentElement.requestFullscreen = vi.fn(async () => { throw new Error("Denied"); });
  fireEvent.click(await openQuiz());
  expect(await screen.findByText(/browser blocked fullscreen/)).toBeTruthy();
  expect(mocks.start).not.toHaveBeenCalled();
});
it("coalesces paired violation events and keeps failed forfeits locked until online retry succeeds", async () => {
  mocks.forfeit.mockResolvedValueOnce({ error: "Offline" }).mockResolvedValueOnce({ attempt: { ...mocks.attempt, submitted_at: new Date().toISOString(), forfeited: true, score: 0, max_score: 2, forfeit_reason: "fullscreen_exit" } });
  fireEvent.click(await openQuiz());
  await screen.findByRole("button", { name: "Submit Quiz Answers" });
  vi.useFakeTimers();
  await act(async () => { fullscreen = null; document.dispatchEvent(new Event("fullscreenchange")); hidden = true; document.dispatchEvent(new Event("visibilitychange")); });
  expect(mocks.forfeit).not.toHaveBeenCalled();
  await act(async () => { fullscreen = document.documentElement; hidden = false; vi.advanceTimersByTime(500); });
  await act(async () => { fullscreen = null; document.dispatchEvent(new Event("fullscreenchange")); });
  expect(screen.getByText(/locked while the violation is recorded/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Submit Quiz Answers" }));
  expect(mocks.submit).not.toHaveBeenCalled();
  await act(async () => { window.dispatchEvent(new Event("online")); });
  expect(mocks.forfeit).toHaveBeenCalledTimes(2);
  expect(screen.getByText(/Attempt Forfeited/)).toBeTruthy();
});



it("updates an open project review without overwriting an unsent repository draft", async () => {
  mocks.activity.activity_type_code = "project";
  mocks.project.mockResolvedValueOnce({ project: { id: "project", max_score: 100, project_overview: "QA project" }, submission: null, review: null })
    .mockResolvedValueOnce({ project: { id: "project", max_score: 100, project_overview: "QA project" }, submission: null, review: { review_status: "revision_requested", score: 40, feedback: "Teacher changed feedback" } });
  window.history.replaceState(null, "", "/student?tab=projects&parentTab=assessments");
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><CacheProvider><ToastProvider>
    <StudentConsole studentId="student" studentEmail="s@example.com" fullName="Student" primaryRole="student" institution={{ id: "campus", name: "QA" }} />
  </ToastProvider></CacheProvider></QueryClientProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "Enter Project" }));
  const input = await screen.findByLabelText("GitHub Repository URL");
  fireEvent.change(input, { target: { value: "https://github.com/qa/unsent" } });
  await act(async () => { window.dispatchEvent(new CustomEvent("hynox:dashboard-change", { detail: ["delivery"] })); });
  expect(await screen.findByText("Teacher changed feedback")).toBeTruthy();
  expect(screen.getByDisplayValue("https://github.com/qa/unsent")).toBeTruthy();
});


it("forfeits at zero when the first fullscreen warning expires", async () => {
  mocks.forfeit.mockResolvedValue({ attempt: { ...mocks.attempt, submitted_at: new Date().toISOString(), forfeited: true, score: 0, max_score: 2, forfeit_reason: "grace_period_expired" } });
  fireEvent.click(await openQuiz());
  await screen.findByRole("button", { name: "Submit Quiz Answers" });
  vi.useFakeTimers();
  await act(async () => { fullscreen = null; document.dispatchEvent(new Event("fullscreenchange")); });
  await act(async () => { vi.advanceTimersByTime(14500); });
  expect(mocks.forfeit).not.toHaveBeenCalled();
  await act(async () => { vi.advanceTimersByTime(500); });
  expect(mocks.forfeit).toHaveBeenCalledWith("attempt", "grace_period_expired");
  expect(screen.getByText(/Attempt Forfeited/)).toBeTruthy();
});

it("does not register a violation when successful submission exits fullscreen", async () => {
  mocks.submit.mockResolvedValue({ attempt: { ...mocks.attempt, submitted_at: new Date().toISOString(), forfeited: false, score: 2, max_score: 2, passed: true } });
  fireEvent.click(await openQuiz());
  fireEvent.click(await screen.findByRole("button", { name: "Submit Quiz Answers" }));
  await screen.findByText("Quiz submitted successfully!");
  await act(async () => { document.dispatchEvent(new Event("fullscreenchange")); });
  expect(mocks.forfeit).not.toHaveBeenCalled();
});
