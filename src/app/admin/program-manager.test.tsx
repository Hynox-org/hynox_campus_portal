// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const data = vi.hoisted(() => ({
  program: { id: "program", title: "QA Program", status_id: "draft" },
  courses: [{ id: "course", title: "Zero duration", slug: "zero", duration_minutes: 0, status_id: "active", visibility_type_id: "private" }],
  statuses: [{ id: "draft", code: "draft" }, { id: "active", code: "active" }],
  visibility: [{ id: "tenant", code: "tenant_only" }, { id: "private", code: "private" }],
  create: vi.fn(), update: vi.fn(), updateProgram: vi.fn(), error: vi.fn(), success: vi.fn(),
  programError: null as Error | null, retryPrograms: vi.fn(),
}));
vi.mock("@/hooks/use-academics", () => ({
  usePrograms: () => ({ data: [data.program], isLoading: false, error: data.programError, refetch: data.retryPrograms }),
  useCourses: () => ({ data: data.courses, isLoading: false }),
  fetchModules: vi.fn(async () => []), fetchLessons: vi.fn(async () => []), fetchResources: vi.fn(async () => []),
  liveCurriculumKeys: { modules: (id: string) => ["academic-modules", id] },
}));
vi.mock("@/hooks/use-library", () => ({ useCourseTemplates: () => ({ data: [] }) }));
vi.mock("@/components/toast", () => ({ useToast: () => ({ showSuccess: data.success, showError: data.error }) }));
vi.mock("@/app/actions/academic-actions", () => ({
  getAcademicLookupsAction: async () => ({ success: true, lookups: { lessonTypes: [], statuses: data.statuses, visibilityTypes: data.visibility } }),
  createCourseAction: data.create, updateCourseAction: data.update, updateProgramAction: data.updateProgram,
}));
import ProgramManager from "./program-manager";
import { fetchModules, fetchLessons, fetchResources } from "@/hooks/use-academics";
beforeEach(() => {
  vi.mocked(fetchModules).mockResolvedValue([]);
  vi.mocked(fetchLessons).mockResolvedValue([]);
  vi.mocked(fetchResources).mockResolvedValue([]);
});
afterEach(() => { cleanup(); data.programError = null; vi.clearAllMocks(); });
function setup() {
  const client = new QueryClient();
  render(<QueryClientProvider client={client}><ProgramManager institutions={[]} mode="examine" selectedInstId="campus"
    setSelectedInstId={() => {}} selectedProgram={data.program} setSelectedProgram={() => {}} /></QueryClientProvider>);
}
it("sends status and visibility when publishing a new course", async () => {
  data.create.mockResolvedValue({ success: true, course: { id: "new" } });
  setup();
  await waitFor(() => expect(screen.getByText("Draft")).toBeTruthy());
  fireEvent.click(screen.getByRole("button", { name: /New Course/ }));
  fireEvent.change(screen.getByLabelText("Course Title *"), { target: { value: "Published course" } });
  fireEvent.change(screen.getByLabelText("Course status"), { target: { value: "active" } });
  fireEvent.change(screen.getByLabelText("Course visibility"), { target: { value: "private" } });
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  await waitFor(() => expect(data.create).toHaveBeenCalledWith(expect.objectContaining({
    program_id: "program", title: "Published course", status_id: "active", visibility_type_id: "private",
  })));
});
it("preserves zero duration and the current metadata while editing", async () => {
  data.update.mockResolvedValue({ success: true });
  setup();
  await screen.findByText("Zero duration");
  fireEvent.click(screen.getByTitle("Edit Course"));
  expect((screen.getByLabelText("Duration (minutes)") as HTMLInputElement).value).toBe("0");
  expect((screen.getByLabelText("Course visibility") as HTMLSelectElement).value).toBe("private");
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  await waitFor(() => expect(data.update).toHaveBeenCalledWith("course", expect.objectContaining({ duration_minutes: 0, status_id: "active", visibility_type_id: "private" })));
});
it("lets an administrator make the parent program visible to its campus", async () => {
  data.updateProgram.mockResolvedValue({ success: true });
  setup();
  await screen.findByRole("option", { name: "tenant_only" });
  fireEvent.change(screen.getByLabelText("Program visibility"), { target: { value: "tenant" } });
  await waitFor(() => expect(data.updateProgram).toHaveBeenCalledWith("program", { visibility_type_id: "tenant" }));
});
it("loads only opened branches and reuses the cache on reopening", async () => {
  vi.mocked(fetchModules).mockResolvedValue([{ id: "module", title: "Lazy module", position: 1 }] as never);
  vi.mocked(fetchLessons).mockResolvedValue([{ id: "lesson", title: "Lazy lesson", position: 1 }] as never);
  vi.mocked(fetchResources).mockResolvedValue([{ id: "resource", title: "Lazy resource", external_url: "https://example.invalid/reference", resource_type: "link" }] as never);
  setup();
  fireEvent.click(await screen.findByText(/Module 1: Lazy module/));
  await screen.findByText(/Lazy lesson/);
  expect(fetchResources).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText(/Lazy lesson/));
  await screen.findByText("Lazy resource");
  fireEvent.click(screen.getByText("Zero duration"));
  expect(fetchModules).toHaveBeenCalledOnce();
  expect(fetchLessons).toHaveBeenCalledOnce();
  expect(fetchResources).toHaveBeenCalledOnce();
});
it("surfaces a failed module request and retries the same selected course", async () => {
  vi.mocked(fetchModules).mockRejectedValueOnce(new Error("Network unavailable"));
  setup();
  await waitFor(() => expect(data.error).toHaveBeenCalledWith("Network unavailable"));
  vi.mocked(fetchModules).mockResolvedValue([{ id: "module", title: "Retry module", position: 1 }] as never);
  fireEvent.click(screen.getByText("Zero duration"));
  await screen.findByText(/Retry module/);
  expect(fetchModules).toHaveBeenCalledTimes(2);
});
it("shows a failed program query with retry rather than pretending the catalog is empty", () => {
  data.programError = new Error("Unavailable");
  setup();
  expect(screen.getByRole("alert").textContent).toContain("Unable to load");
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(data.retryPrograms).toHaveBeenCalledOnce();
});
