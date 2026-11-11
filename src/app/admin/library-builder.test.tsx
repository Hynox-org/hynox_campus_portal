// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const mocks = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), modules: vi.fn(), lessons: vi.fn(), resources: vi.fn(), create: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn(), getQueryData: () => [], getQueryCache: () => ({ subscribe: () => () => {} }) }) }));
vi.mock("@/hooks/use-library", () => ({
  useCourseTemplates: () => ({ data: [{ id: "course", title: "Retry Blueprint", slug: "retry", is_published: false }], isLoading: false }),
  libraryKeys: { courseTemplates: ["course-templates"] }, fetchModuleTemplates: mocks.modules,
  fetchLessonTemplates: mocks.lessons, fetchResourceTemplates: mocks.resources,
}));
vi.mock("@/app/actions/library-actions", () => ({ createCourseTemplateAction: mocks.create }));
vi.mock("@/components/toast", () => ({ useToast: () => ({ showSuccess: mocks.success, showError: mocks.error }) }));
vi.mock("@/components/secondary-loader", () => ({ SecondaryLoader: () => <div>Loading curriculum</div> }));
vi.mock("@/components/markdown-renderer", () => ({ MarkdownRenderer: () => null }));
import LibraryBuilder from "./library-builder";

describe("blueprint UI recovery", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.modules.mockResolvedValue([]); });
  afterEach(cleanup);
  it("surfaces load failures and retries the same course", async () => {
    mocks.modules.mockRejectedValueOnce(new Error("Network unavailable"));
    render(<LibraryBuilder />);
    fireEvent.click(screen.getByText("Retry Blueprint"));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("Network unavailable"));
    fireEvent.click(screen.getAllByText("Retry Blueprint")[0]);
    await waitFor(() => expect(mocks.modules).toHaveBeenCalledTimes(2));
  });
  it("loads descendants only when expanded and reuses already loaded branches", async () => {
    mocks.modules.mockResolvedValue([{ id: "module", title: "Module A", position: 1 }]);
    mocks.lessons.mockResolvedValue([{ id: "lesson", title: "Lesson A" }]);
    mocks.resources.mockResolvedValue([]);
    render(<LibraryBuilder />);
    fireEvent.click(screen.getByText("Retry Blueprint"));
    await screen.findByText("Module 1: Module A");
    expect(mocks.lessons).not.toHaveBeenCalled();
    expect(mocks.resources).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Module 1: Module A"));
    await screen.findByText("Lesson A");
    expect(mocks.lessons).toHaveBeenCalledTimes(1);
    expect(mocks.resources).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Lesson A"));
    await waitFor(() => expect(mocks.resources).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByText("Lesson A"));
    fireEvent.click(screen.getByText("Lesson A"));
    expect(mocks.resources).toHaveBeenCalledTimes(1);
  });
  it("offers an explicit publication checkbox", () => {
    render(<LibraryBuilder />);
    fireEvent.click(screen.getByText("New Template"));
    const checkbox = screen.getByRole("checkbox", { name: /Published/ }) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
  });
});
