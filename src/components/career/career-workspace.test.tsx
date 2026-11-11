// @vitest-environment jsdom
import React, { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
vi.mock("@/app/actions/career-actions", () => ({ loadCareerAction: vi.fn(), saveResumeAction: vi.fn(), deleteResumeAction: vi.fn() }));
import { loadCareerAction, saveResumeAction } from "@/app/actions/career-actions";
import { validateResume, type SavedResume } from "@/lib/resume";
import CareerWorkspace, { type CareerView } from "./career-workspace";

function StudentTabs() {
  const [view, setView] = useState<CareerView>("resumes");
  const [career, setCareer] = useState(true);
  return <><button onClick={() => setCareer(!career)}>Toggle hub tab</button>
    <div hidden={!career}><CareerWorkspace studentId="student" fullName="QA Student" email="qa@example.com" view={view} onViewChange={setView} /></div></>;
}

beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear();
  vi.mocked(loadCareerAction).mockResolvedValue({ data: { resumes: [], scans: [], learning: [], shared: false } });
  vi.mocked(saveResumeAction).mockImplementation(async input => ({ data: { ...input, title: input.title.trim(), content: validateResume(input.content), template: input.template as SavedResume["template"], version: input.version + 1, updated_at: new Date().toISOString() } }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

it("settles autosave after server normalization instead of saving forever", async () => {
  render(<StudentTabs />);
  await waitFor(() => expect(screen.getByRole("button", { name: "New resume" }).hasAttribute("disabled")).toBe(false));
  vi.useFakeTimers();
  fireEvent.click(screen.getByRole("button", { name: "New resume" }));
  fireEvent.change(screen.getByLabelText("Resume name"), { target: { value: "  Test Resume  " } });
  await act(async () => { await vi.advanceTimersByTimeAsync(1200); });
  expect(saveResumeAction).toHaveBeenCalledTimes(1);
  expect((screen.getByLabelText("Resume name") as HTMLInputElement).value).toBe("Test Resume");
  expect(screen.getByRole("status").textContent).toContain("Saved");
  await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
  expect(saveResumeAction).toHaveBeenCalledTimes(1);
});

it("preserves edits made while a save is in flight and saves the latest revision", async () => {
  let complete: ((value: Awaited<ReturnType<typeof saveResumeAction>>) => void) | undefined;
  let firstInput: Parameters<typeof saveResumeAction>[0] | undefined;
  vi.mocked(saveResumeAction).mockImplementationOnce(input => { firstInput = input; return new Promise(resolve => { complete = resolve; }); });
  render(<StudentTabs />);
  await waitFor(() => expect(screen.getByRole("button", { name: "New resume" }).hasAttribute("disabled")).toBe(false));
  vi.useFakeTimers();
  fireEvent.click(screen.getByRole("button", { name: "New resume" }));
  await act(async () => { await vi.advanceTimersByTimeAsync(1200); });
  expect(firstInput).toBeDefined();
  fireEvent.change(screen.getByLabelText("Headline"), { target: { value: "Edited while saving" } });
  await act(async () => { complete!({ data: { ...firstInput!, content: validateResume(firstInput!.content), template: "classic", version: 1, updated_at: new Date().toISOString() } }); });
  expect(saveResumeAction).toHaveBeenCalledTimes(2);
  expect(vi.mocked(saveResumeAction).mock.calls[1][0]).toMatchObject({ version: 1, content: { basics: { headline: "Edited while saving" } } });
  expect((screen.getByLabelText("Headline") as HTMLInputElement).value).toBe("Edited while saving");
  expect(screen.getByRole("status").textContent).toContain("Saved");
});


it("keeps the draft and loaded data when another hub tab hides the workspace", async () => {
  render(<StudentTabs />);
  await waitFor(() => expect(screen.getByRole("button", { name: "New resume" }).hasAttribute("disabled")).toBe(false));
  vi.useFakeTimers();
  fireEvent.click(screen.getByRole("button", { name: "New resume" }));
  fireEvent.change(screen.getByLabelText("Headline"), { target: { value: "Keep this draft" } });
  fireEvent.click(screen.getByRole("button", { name: "Toggle hub tab" }));
  expect(screen.queryByRole("button", { name: "New resume" })).toBeNull();
  await act(async () => { await vi.advanceTimersByTimeAsync(1200); });
  fireEvent.click(screen.getByRole("button", { name: "Toggle hub tab" }));
  expect((screen.getByLabelText("Headline") as HTMLInputElement).value).toBe("Keep this draft");
  expect(loadCareerAction).toHaveBeenCalledTimes(1);
  expect(saveResumeAction).toHaveBeenCalledTimes(1);
});
