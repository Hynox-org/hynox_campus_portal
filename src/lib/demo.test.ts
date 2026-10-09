import { afterEach, describe, expect, it, vi } from "vitest";
import { isDemoMode, isDemoRole, resolveDemoRole } from "./demo";

afterEach(() => vi.unstubAllEnvs());

describe("demo configuration", () => {
  it("enables the dev demo by default and supports restoring authentication", () => {
    vi.stubEnv("DEMO_MODE", undefined);
    expect(isDemoMode()).toBe(true);
    vi.stubEnv("DEMO_MODE", "false");
    expect(isDemoMode()).toBe(false);
  });

  it.each([
    ["/admin", "super_admin"],
    ["/admin/users", "super_admin"],
    ["/institution", "institution_admin"],
    ["/teacher", "teacher"],
    ["/student", "student"],
    ["/student/programming/challenge", "student"],
  ])("uses the correct identity for %s", (path, role) => {
    expect(resolveDemoRole(path, "teacher")).toBe(role);
  });

  it("retains the selected role for course pages and API calls", () => {
    expect(resolveDemoRole("/academic/program/course", "institution_admin")).toBe("institution_admin");
    expect(resolveDemoRole("/api/quiz-forfeit", "student")).toBe("student");
  });

  it("accepts only the four fixed roles, including inherited property names", () => {
    for (const role of ["constructor", "toString", "__proto__", "unknown", "", undefined]) {
      expect(isDemoRole(role)).toBe(false);
      expect(resolveDemoRole("/academic", role)).toBe("student");
    }
    expect(resolveDemoRole("/administrator", "teacher")).toBe("teacher");
    expect(resolveDemoRole("/constructor", "teacher")).toBe("teacher");
    expect(resolveDemoRole("/__proto__", "teacher")).toBe("teacher");
  });
});
