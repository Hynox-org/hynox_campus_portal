// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CacheProvider } from "@/components/cache-provider";
import { ToastProvider } from "@/components/toast";

vi.mock("@/hooks/use-delivery", () => ({ useStudentDeliveryData: () => ({ data: { programs: [] }, isLoading: false, error: null }) }));
vi.mock("@/hooks/use-academics", () => ({ useAcademicPrefetchData: () => ({ data: null }) }));
vi.mock("@/app/actions/delivery-actions", () => ({
  getStudentDeliveryDataAction: vi.fn(async () => ({ programs: [] })),
  listStudentLessonProgressAction: vi.fn(async () => ({ progressList: [] })),
}));
vi.mock("@/app/actions/learning-actions", () => ({ getStudentAssignedActivitiesAction: vi.fn(async () => ({ activities: [] })) }));
vi.mock("@/components/sign-out-button", () => ({ default: () => <button>Sign out</button> }));
vi.mock("@/components/dashboard-loader", () => ({ DashboardLoader: () => null }));
vi.mock("@/components/career/career-workspace", () => ({ default: () => <div>Career workspace</div> }));
vi.mock("./actions", () => ({ loadStudentNewsletter: vi.fn(), saveStudentNewsletter: vi.fn() }));
vi.mock("@/services/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn((target: string) => { throw new Error(`redirect:${target}`); }) }));

import { loadStudentNewsletter } from "./actions";
import { getCurrentUser } from "@/services/auth";
import StudentConsole from "@/app/student/student-console";
import StudentNewsletterPage from "@/app/student/newsletters/page";

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null,"","/student");
  vi.mocked(loadStudentNewsletter).mockResolvedValue({ data: { preference: null, shared: false, courses: [{ course_id: "ai-course", title: "Artificial Intelligence" }] } });
});
afterEach(cleanup);

function dashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><CacheProvider><ToastProvider><StudentConsole studentId="student-1" studentEmail="student@example.com" fullName="Student" primaryRole="student" institution={null} /></ToastProvider></CacheProvider></QueryClientProvider>);
}

it("opens field updates in the existing shell and synchronizes its URL without a page navigation", async () => {
  dashboard();
  fireEvent.click(screen.getByRole("button", { name: "Daily Field Updates" }));
  expect(await screen.findByRole("heading", { name: "Your daily field update" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Daily Field Updates" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("button", { name: "Overview" })).toBeVisible();
  await waitFor(() => {
    const params = new URLSearchParams(window.location.search);
    expect(params.get("parentTab")).toBe("newsletters");
    expect(params.get("tab")).toBe("newsletters");
  });
  expect(window.location.pathname).toBe("/student");
});

it.each(["?parentTab=newsletters&tab=newsletters", "?tab=newsletters", "?parentTab=newsletters"])("restores the field updates tab from a direct URL: %s", async search => {
  window.history.replaceState(null,"",`/student${search}`);
  dashboard();
  expect(await screen.findByRole("heading", { name: "Your daily field update" })).toBeVisible();
  await waitFor(() => {
    const params = new URLSearchParams(window.location.search);
    expect(params.get("parentTab")).toBe("newsletters");
    expect(params.get("tab")).toBe("newsletters");
  });
});

it("removes career and lesson URL state when moving to field updates", async () => {
  window.history.replaceState(null,"","/student?parentTab=career&tab=career&view=scanner&c=2&l=3");
  dashboard();
  await screen.findByText("Career workspace");
  fireEvent.click(screen.getByRole("button", { name: "Daily Field Updates" }));
  await waitFor(() => {
    const params = new URLSearchParams(window.location.search);
    expect(params.get("parentTab")).toBe("newsletters");
    for (const key of ["view","c","l"]) expect(params.has(key)).toBe(false);
  });
});

it("preserves the preference form when leaving and returning to the dashboard tab", async () => {
  dashboard();
  fireEvent.click(screen.getByRole("button", { name: "Daily Field Updates" }));
  fireEvent.click(await screen.findByRole("checkbox"));
  expect(screen.getByRole("checkbox")).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Overview" }));
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  await waitFor(() => expect(new URLSearchParams(window.location.search).get("parentTab")).toBe("overview"));
  fireEvent.click(screen.getByRole("button", { name: "Daily Field Updates" }));
  expect(screen.getByRole("checkbox")).toBeChecked();
  expect(loadStudentNewsletter).toHaveBeenCalledTimes(1);
});

it("redirects the old standalone URL into the student dashboard", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue({ user: { id: "student-1" }, authUser: {}, primaryRole: "student", tenantId: null, institution: null });
  await expect(StudentNewsletterPage()).rejects.toThrow("redirect:/student?parentTab=newsletters&tab=newsletters");
});

it("keeps authentication protection on the legacy URL", async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(null);
  await expect(StudentNewsletterPage()).rejects.toThrow("redirect:/login");
});
