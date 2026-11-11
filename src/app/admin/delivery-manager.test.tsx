// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ loading: true, error: null as Error | null, retry: vi.fn(), scope: vi.fn(), programs: [],
  delivery: null as null | { cohorts: Array<{ id: string; name: string; code: string; program_id: string }> },
}));
vi.mock("@/hooks/use-delivery", () => ({
  useDeliveryData: (id: string) => { state.scope(id); return { data: state.delivery, isLoading: state.loading, error: state.error, refetch: state.retry }; },
  useLearningData: () => ({ data: undefined }),
}));
vi.mock("@/hooks/use-academics", () => ({ usePrograms: () => ({ data: state.programs }),
  useCourses: (id: string) => ({ data: id ? [{ id: `course-${id}`, title: `Course for ${id}` }] : [], isLoading: false, error: null }),
}));
vi.mock("@/components/toast", () => ({ useToast: () => ({ showError: vi.fn(), showSuccess: vi.fn() }) }));
vi.mock("@/app/actions/delivery-actions", () => ({ getDeliveryLookupsAction: async () => ({ lookups: { cohortStatuses: [], enrollmentStatuses: [] } }) }));
import DeliveryManager from "./delivery-manager";
afterEach(() => { cleanup(); state.loading = true; state.error = null; state.delivery = null; vi.clearAllMocks(); });
function setup() {
  render(<QueryClientProvider client={new QueryClient()}><DeliveryManager institutions={[{ id: "campus", name: "QA" }]} initialTab="cohorts" /></QueryClientProvider>);
}
it("shows initial loading rather than incorrectly claiming there are no groups", () => {
  setup();
  expect(screen.getByText("Syncing delivery records...")).toBeTruthy();
  expect(screen.queryByText(/No groups defined/)).toBeNull();
});
it("surfaces a failed query and allows retry instead of showing an empty table", () => {
  state.loading = false; state.error = new Error("Unavailable");
  setup();
  expect(screen.getByRole("alert").textContent).toContain("Unable to load delivery");
  expect(screen.queryByText(/No groups defined/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(state.retry).toHaveBeenCalledOnce();
});
it("starts campus queries when institutions arrive after the initial mount", async () => {
  const client = new QueryClient();
  const view = render(<QueryClientProvider client={client}><DeliveryManager institutions={[]} initialTab="cohorts" /></QueryClientProvider>);
  expect(state.scope).toHaveBeenLastCalledWith("");
  view.rerender(<QueryClientProvider client={client}><DeliveryManager institutions={[{ id: "campus", name: "QA" }]} initialTab="cohorts" /></QueryClientProvider>);
  await waitFor(() => expect(state.scope).toHaveBeenLastCalledWith("campus"));
});
it("loads courses for the cohort program and clears a stale course when the group changes", async () => {
  state.loading = false;
  state.delivery = { cohorts: [{ id: "group-a", name: "A", code: "A", program_id: "program-a" }, { id: "group-b", name: "B", code: "B", program_id: "program-b" }] };
  render(<QueryClientProvider client={new QueryClient()}><DeliveryManager institutions={[{ id: "campus", name: "QA" }]} initialTab="assignments" /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Assign Course" }));
  await screen.findByRole("option", { name: "Course for program-a" });
  fireEvent.change(screen.getByLabelText("Select Academic Course *"), { target: { value: "course-program-a" } });
  fireEvent.change(screen.getByLabelText("Select Group *"), { target: { value: "group-b" } });
  expect((screen.getByLabelText("Select Academic Course *") as HTMLSelectElement).value).toBe("");
  expect(screen.queryByRole("option", { name: "Course for program-a" })).toBeNull();
  expect(screen.getByRole("option", { name: "Course for program-b" })).toBeTruthy();
});
