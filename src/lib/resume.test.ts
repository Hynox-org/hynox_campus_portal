import { describe, expect, it } from "vitest";
import { emptyResume, newEntry, resumeText, safeLink, validateResume } from "./resume";
import { analyzeResume, containsTerm } from "./resume-scanner";
describe("resume validation", () => {
  it("round trips drafts without requiring optional experience", () => expect(validateResume(emptyResume("Student", "student@example.com")).basics.fullName).toBe("Student"));
  it("rejects unsafe links, oversized text, duplicate ids and forged source formats", () => {
    const r = emptyResume(); r.basics.website = "javascript:alert(1)";
    expect(() => validateResume(r)).toThrow(/Links/);
    r.basics.website = ""; r.basics.summary = "x".repeat(3001);
    expect(() => validateResume(r)).toThrow(); r.basics.summary = "";
    const e = newEntry(); r.sections[0].entries = [e, e]; expect(() => validateResume(r)).toThrow(/duplicate/);
    r.sections[0].entries = [{ ...e, sourceKey: "course:fake" }]; expect(() => validateResume(r)).toThrow(/learning/);
    expect(safeLink("data:text/html,bad")).toBeUndefined();
  });
  it("keeps exported text in the chosen section order", () => {
    const r = emptyResume(); r.sections = r.sections.slice(0, 2).reverse();
    for (const s of r.sections) s.entries = [{ ...newEntry(), title: s.kind }];
    expect(resumeText(r).indexOf("Experience")).toBeLessThan(resumeText(r).indexOf("Education"));
  });
});
describe("transparent resume checks", () => {
  it("does not confuse Java with JavaScript or C with C++", () => {
    expect(containsTerm("JavaScript", "Java")).toBe(false);
    expect(containsTerm("C++", "C")).toBe(false);
    expect(containsTerm("Use C++ and C#", "C++")).toBe(true);
  });
  it("only matches actual requested skills and handles empty job descriptions", () => {
    const r = analyzeResume("Education\n2026\nSkills\nPython SQL\nProjects\nBuilt a tool for 20 students.", "Requires Python, SQL and JavaScript");
    expect(r.matched).toEqual(["Python", "SQL"]); expect(r.missing).toEqual(["JavaScript"]); expect(r.match).toBe(67);
    expect(analyzeResume("resume").match).toBeNull(); expect(analyzeResume("resume", "We need someone enthusiastic").match).toBeNull();
  });
  it("does not require employment for freshers or reward unreadable PDFs", () => {
    const report = analyzeResume("Projects\nBuilt an app\nEducation\n2026\nSkills\nSQL");
    expect(report.findings.find(f => f.id === "evidence")?.passed).toBe(true);
    expect(analyzeResume("").findings.find(f => f.id === "text")?.passed).toBe(false);
    expect(() => analyzeResume("x".repeat(150001))).toThrow();
  });
  it("does not treat an education date range as a contact phone", () => {
    expect(analyzeResume("Education\n2023-2027").findings.find(f => f.id === "phone")?.passed).toBe(false);
    expect(analyzeResume("Contact +91 90000 00000").findings.find(f => f.id === "phone")?.passed).toBe(true);
  });
});

 it("uses optional roles alone and together with job descriptions", () => {
   expect(analyzeResume("HTML CSS JavaScript React Git", "", "text", null, "Frontend Developer").match).toBe(100);
   const result = analyzeResume("React Git", "Requires TypeScript", "text", null, "Frontend Developer");
   expect(result.missing).toContain("TypeScript");
   expect(result.missing).toContain("HTML");
   expect(result.matched).toContain("React");
   expect(analyzeResume("Python", "", "text", null, "Python Developer").match).toBe(100);
   expect(analyzeResume("text", "", "text", null, "Astronaut").match).toBeNull();
   expect(() => analyzeResume("text", "", "text", null, "a".repeat(201))).toThrow("Role");
 });
