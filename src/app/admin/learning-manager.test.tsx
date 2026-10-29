// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import LearningManager from "./learning-manager";
import { getActivityDetailsNoStudentAction, listActivityProgressAction } from "@/app/actions/learning-actions";
vi.mock("@/components/toast", () => ({ useToast: () => ({ showError: vi.fn(), showSuccess: vi.fn() }) }));
vi.mock("@/app/teacher/challenge-editor", () => ({ default: () => null }));
vi.mock("@/app/actions/learning-actions", () => ({
  getActivityDetailsNoStudentAction: vi.fn(async () => ({ project: { id: "project", project_overview: "QA" }, assignments: [] })),
  listActivityProgressAction: vi.fn(async () => ({ progress: [] })),
}));
vi.mock("@/app/actions/prefetch-actions", () => ({ getInstitutionPrefetchDataAction: vi.fn(), getDeliveryPrefetchDataAction: vi.fn() }));
vi.mock("@/app/actions/academic-actions", () => ({}));
afterEach(cleanup);

it("shows quiz progress against question points instead of the configured activity scale", async () => {
  vi.mocked(getActivityDetailsNoStudentAction).mockResolvedValueOnce({ quiz: { id: "quiz", activity_id: "quiz", time_limit_minutes: 30, max_attempts: 1, shuffle_questions: false, shuffle_options: false, show_results_immediately: true, strict_mode: false, created_at: "2026-10-29", updated_at: "2026-10-29" }, questions: [{ id: "q", options: [], quiz_id: "quiz", question_text: "QA question", question_type: "single_choice", points: 8, position: 1, created_at: "2026-10-29", updated_at: "2026-10-29" }], assignments: [] });
  vi.mocked(listActivityProgressAction).mockResolvedValueOnce({ progress: [{ id: "p", score: 8, status_code: "completed", updated_at: "2026-10-29", student: { full_name: "QA Student" } }] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["academic-prefetch", "campus"], { success: true, programs: [], courses: [] });
  client.setQueryData(["delivery-prefetch", "campus"], { success: true, cohorts: [] });
  client.setQueryData(["all-activities", "campus"], [{ id: "quiz", title: "QA quiz", activity_type_code: "quiz", max_score: 100, passing_score: 60, cohort_ids: [] }]);
  render(<QueryClientProvider client={client}><LearningManager institutions={[{ id: "campus", name: "QA" }]} mode="view" lockInstitution /></QueryClientProvider>);
  fireEvent.click(await screen.findByTitle("View details"));
  fireEvent.click(await screen.findByRole("button", { name: "Performance (1)" }));
  expect(await screen.findByText("Score: 8 / 8")).toBeTruthy();
});

it("places the activity console outside animated dashboard ancestors so its header stays in the viewport", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["academic-prefetch", "campus"], { success: true, programs: [], courses: [] });
  client.setQueryData(["delivery-prefetch", "campus"], { success: true, cohorts: [] });
  client.setQueryData(["all-activities", "campus"], [{ id: "activity", title: "QA project", activity_type_code: "project", max_score: 100, passing_score: 60, cohort_ids: [] }]);
  const { container } = render(<QueryClientProvider client={client}><div style={{ transform: "translateY(0)" }}>
    <LearningManager institutions={[{ id: "campus", name: "QA" }]} mode="view" lockInstitution />
  </div></QueryClientProvider>);
  fireEvent.click(await screen.findByTitle("View details"));
  const heading = await screen.findByRole("heading", { name: "Activity Console" });
  expect(container.contains(heading)).toBe(false);
  expect(document.body.contains(heading)).toBe(true);
});


