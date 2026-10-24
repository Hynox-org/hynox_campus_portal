// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ResumeScanner } from "./resume-scanner";
import { scanResumeAction } from "@/app/actions/career-actions";
vi.mock("@/app/actions/career-actions", () => ({ scanResumeAction: vi.fn(), deleteScanAction: vi.fn() }));
afterEach(cleanup);
it("submits the optional role without requiring a job description", async () => {
  vi.mocked(scanResumeAction).mockResolvedValue({ error: "Test complete" });
  render(<ResumeScanner resumes={[]} scans={[]} onScans={() => {}} onEdit={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: "Paste text" }));
  fireEvent.change(screen.getByLabelText("Resume text"), { target: { value: "Education\nSkills\nReact JavaScript CSS" } });
  fireEvent.change(screen.getByLabelText("Role", { exact: false }), { target: { value: "Frontend Developer" } });
  fireEvent.click(screen.getByRole("button", { name: "Scan and save report" }));
  await waitFor(() => expect(scanResumeAction).toHaveBeenCalledWith(expect.objectContaining({ role: "Frontend Developer", job: "", source: "text" })));
});
