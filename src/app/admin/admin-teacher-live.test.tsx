// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
const data = vi.hoisted(() => ({
  groups: [{ id: "group-a", name: "Original group", code: "A", institution: { name: "QA Campus" } }],
}));
vi.mock("@/hooks/use-admin", () => ({ useAdminData: () => ({ data: null, isLoading: false }) }));
vi.mock("@/hooks/use-academics", () => Object.fromEntries(["usePrograms", "useTenantInstructors", "useCourses", "useCourseModules", "useCourseInstructors", "useAcademicLookups", "useAcademicPrefetchData"].map(name => [name, () => ({})])));
vi.mock("@/components/toast", () => ({ useToast: () => ({ showSuccess: vi.fn(), showError: vi.fn() }) }));
vi.mock("@/components/app-shell", () => ({ default: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("@/app/actions/institution-actions", () => ({ listAllTeachersAction: async () => ({ teachers: [{ id: "teacher", full_name: "Test Teacher", email: "teacher@example.invalid", mapped_tenant_ids: [] }] }) }));
vi.mock("@/app/actions/delivery-actions", () => ({
  listAllCohortsAction: async () => ({ cohorts: [] }),
  listTeacherCohortsAction: async () => ({ cohorts: data.groups }),
}));
import AdminPanel from "./admin-panel";
afterEach(cleanup);
it("refreshes an already open teacher mapping drawer when its query is invalidated", async () => {
  window.history.replaceState(null, "", "/admin?parentTab=onboarding&tab=teacher_assignments");
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><AdminPanel adminEmail="admin@example.invalid" /></QueryClientProvider>);
  fireEvent.click(await screen.findByRole("heading", { name: /Test Teacher/ }));
  await screen.findByRole("heading", { name: /Original group/ });
  data.groups = [...data.groups, { id: "group-b", name: "New collaborative group", code: "B", institution: { name: "QA Campus" } }];
  await act(async () => { await client.invalidateQueries({ queryKey: ["teacher-cohorts", "teacher"] }); });
  await waitFor(() => expect(screen.getByRole("heading", { name: /New collaborative group/ })).toBeTruthy());
  expect(screen.getByRole("heading", { name: /Original group/ })).toBeTruthy();
});
