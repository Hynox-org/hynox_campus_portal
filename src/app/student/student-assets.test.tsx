// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CacheProvider } from "@/components/cache-provider";
import { ToastProvider } from "@/components/toast";
const data = vi.hoisted(() => {
  const course = { id: "course", title: "QA Formats", cohort_id: "cohort", progress: { progress_percentage: 0, completed_lessons: 0, total_lessons: 1, completed_activities: 0, total_activities: 1 } };
  const programs = [{ id: "program", title: "QA", cohorts: [{ id: "cohort", name: "QA group", code: "QA" }], courses: [course] }];
  return { programs, prefetch: { success: true, programs, courses: [{ ...course, program_id: "program" }],
    modules: [{ id: "module", course_id: "course", title: "QA module", position: 1 }],
    lessons: [{ id: "lesson", module_id: "module", title: "QA lesson", content_json: { body: "QA text" }, lesson_type: { code: "text" } }] } };
});
vi.mock("@/hooks/use-delivery", () => ({ useStudentDeliveryData: () => ({ data: { programs: data.programs }, isLoading: false, error: null }) }));
vi.mock("@/hooks/use-academics", () => ({ useAcademicPrefetchData: () => ({ data: data.prefetch }) }));
vi.mock("@/app/actions/delivery-actions", () => ({
  getStudentDeliveryDataAction: vi.fn(async () => ({ programs: data.programs })),
  listStudentLessonProgressAction: vi.fn(async () => ({ progressList: [] })),
  startOrUpdateLessonProgressAction: vi.fn(async () => ({ progress: { status_code: "in_progress" } })),
}));
vi.mock("@/app/actions/academic-actions", () => ({ listLessonResourcesAction: vi.fn(async () => ({ resources: [{ id: "resource", title: "QA PDF attachment", external_url: "https://example.com/notes.pdf", resource_type: "pdf" }] })) }));
vi.mock("@/app/actions/learning-actions", () => ({ getStudentAssignedActivitiesAction: vi.fn(async () => ({ activities: [] })) }));
vi.mock("@/app/actions/attendance-actions", () => ({ getAttendanceRegisterAction: vi.fn(async () => ({})), getStudentAttendanceSummaryAction: vi.fn(async () => ({})) }));
vi.mock("@/components/sign-out-button", () => ({ default: () => null }));
vi.mock("@/components/dashboard-loader", () => ({ DashboardLoader: () => null }));
import StudentConsole from "./student-console";
import { listLessonResourcesAction } from "@/app/actions/academic-actions";
import { listStudentLessonProgressAction } from "@/app/actions/delivery-actions";
beforeEach(() => { vi.clearAllMocks(); data.programs[0].courses[0].progress.progress_percentage = 0; window.history.replaceState(null, "", "/student?tab=academics&parentTab=curriculum"); });
afterEach(cleanup);
it.each([false, true])("loads attachments and preserves them on reopening (URL restore: %s)", async restored => {
  if (restored) window.history.replaceState(null, "", "/student?tab=academics&parentTab=curriculum&c=0&l=0");
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><CacheProvider><ToastProvider>
    <StudentConsole studentId="student" studentEmail="student@example.com" fullName="Student" primaryRole="student" institution={{ id: "campus", name: "QA" }} />
  </ToastProvider></CacheProvider></QueryClientProvider>);
  if (!restored) {
    fireEvent.click(await screen.findByRole("button", { name: "Open course QA Formats" }));
    fireEvent.click(await screen.findByRole("button", { name: /^Open lesson QA lesson/ }));
  }
  expect(await screen.findByText("QA PDF attachment")).toBeTruthy();
  expect(screen.getByRole("link", { name: /Open\/Download/ }).getAttribute("href")).toBe("https://example.com/notes.pdf");
  fireEvent.click(screen.getByRole("button", { name: /^Open lesson QA lesson/ }));
  expect(await screen.findByText("QA PDF attachment")).toBeTruthy();
  expect(listLessonResourcesAction).toHaveBeenCalledTimes(1);
});
it("uses course progress including required activities after all learning lessons are complete", async () => {
  data.programs[0].courses[0].progress = { progress_percentage: 50, completed_lessons: 1, total_lessons: 1, completed_activities: 0, total_activities: 1 };
  vi.mocked(listStudentLessonProgressAction).mockResolvedValueOnce({ progressList: [{ lesson_id: "lesson", status_code: "completed" }] } as never);
  window.history.replaceState(null, "", "/student?tab=academics&parentTab=curriculum&c=0&l=0");
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><CacheProvider><ToastProvider>
    <StudentConsole studentId="student" studentEmail="student@example.com" fullName="Student" primaryRole="student" institution={{ id: "campus", name: "QA" }} />
  </ToastProvider></CacheProvider></QueryClientProvider>);
  expect(await screen.findByText("1/1 lessons")).toBeTruthy();
  expect(screen.getByText("50%")).toBeTruthy();
});
