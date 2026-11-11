import { expect, it } from "vitest";
import { validateAcademicInput, validateAssignmentIds } from "./academic-validation";
const id = "11111111-1111-4111-8111-111111111111";
it("normalizes required text while preserving zero duration and false flags", () => {
  expect(validateAcademicInput({ title: "  Lesson  ", duration: 0, is_preview: false }, ["title"]))
    .toEqual({ title: "Lesson", duration: 0, is_preview: false });
});
it.each([null, [], "bad", {}, { title: " " }, { title: "x", position: -1 }, { title: "x", duration: NaN },
  { title: "x", video_url: "javascript:alert(1)" }, { title: "x", external_url: "https://user:secret@example.com" },
  { title: "x", module_id: "missing" }, { title: "x", is_preview: "true" }, { title: "x", content_json: [] },
  { title: "x", start_date: "2026-02-30" }, { title: "x", start_date: "2026-10-28", end_date: "2026-10-27" },
  { title: "x", enrollment_mode: "anything" }, { title: "x", slug: "../other" }])("rejects malformed input %#", input => {
  expect(() => validateAcademicInput(input, ["title"])).toThrow();
});
it("allows clearing dates/media and rejects duplicate or malformed teacher lists", () => {
  expect(validateAcademicInput({ video_url: "", start_date: "" })).toEqual({ video_url: "", start_date: "" });
  expect(() => validateAssignmentIds(id, [])).not.toThrow();
  expect(() => validateAssignmentIds(id, [id, id])).toThrow("Duplicate");
  expect(() => validateAssignmentIds(id, ["bad"])).toThrow();
  expect(() => validateAssignmentIds(id, null)).toThrow();
});
