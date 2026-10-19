// @vitest-environment jsdom
import React, { useState } from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { emptyResume, type LearningItem } from "@/lib/resume";
import { ResumeEditor } from "./resume-editor";
afterEach(cleanup);
const item: LearningItem = { source_key: "course:10000000-0000-4000-8000-000000000001", title: "Python Foundations", kind: "courses", subtitle: "Hynox Campus course", completed_at: "2026-10-19T00:00:00Z", url: "" };
function Editor() { const [content, setContent] = useState(emptyResume()); return <ResumeEditor content={content} onChange={setContent} learning={[item]} announce={() => {}} />; }
it("adds a completed course with the accessible Add control and prevents duplicates", () => {
  render(<Editor />);
  fireEvent.click(screen.getByRole("button", { name: "Add Python Foundations to resume" }));
  expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Python Foundations");
  expect((screen.getByLabelText("End / completion date") as HTMLInputElement).value).toBe("2026-10");
  expect(screen.getByRole("button", { name: "Add Python Foundations to resume" }).hasAttribute("disabled")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Unlink" }));
  expect(screen.getByRole("button", { name: "Add Python Foundations to resume" }).hasAttribute("disabled")).toBe(false);
});
it("accepts an eligible learning card dropped into the editor", () => {
  render(<Editor />);
  fireEvent.click(screen.getByRole("button", { name: "Courses 0" }));
  fireEvent.drop(document.getElementById("career-courses")!, { dataTransfer: { getData: () => item.source_key } });
  expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Python Foundations");
});
