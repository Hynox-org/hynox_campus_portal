import { describe, expect, it } from "vitest";
import { validateBlueprintInput } from "./library-validation";

describe("blueprint input validation", () => {
  it.each([null, [], "bad", {}, { title: "A" }, { title: 2, slug: "a" }, { title: "A", slug: "../path" }])("rejects missing/malformed course: %j", input => {
    expect(() => validateBlueprintInput(input as object, "course")).toThrow();
  });
  it.each([-1, 0, 1.5, NaN, Infinity, "1", 2147483648])("rejects invalid ordering %s", position => {
    expect(() => validateBlueprintInput({ position }, "lesson", true)).toThrow();
  });
  it.each(["javascript:alert(1)", "data:text/html,x", "https://user:secret@example.com", "not-a-url"])("rejects unsafe links %s", external_url => {
    expect(() => validateBlueprintInput({ title: "Link", lesson_template_id: "04000000-0000-4000-8000-000000000001", resource_type: "link", external_url }, "resource")).toThrow();
  });
  it("rejects resources without a URL", () => {
    expect(() => validateBlueprintInput({ title: "Link", lesson_template_id: "04000000-0000-4000-8000-000000000001", resource_type: "link" }, "resource")).toThrow("URL is required");
  });
  it.each(["assignment", "assessment", "unknown"])("rejects unsupported lessons %s", lesson_type_code => {
    expect(() => validateBlueprintInput({ lesson_type_code }, "lesson", true)).toThrow();
  });
  it("allows a publication-only update", () => {
    expect(validateBlueprintInput({ is_published: false }, "course", true)).toEqual({ is_published: false });
  });
});
