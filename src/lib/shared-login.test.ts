import { describe, expect, it } from "vitest";
import { isSharedLogin, selectedSharedRole, SHARED_DASHBOARDS } from "./shared-login";

describe("temporary shared login", () => {
  it("offers exactly the four official dashboard roles", () => {
    expect(Object.keys(SHARED_DASHBOARDS).sort()).toEqual(["institution_admin", "student", "super_admin", "teacher"]);
    expect(selectedSharedRole("auth-1:trainer", "auth-1", ["trainer"])).toBeNull();
  });
  it("requires an administrator-controlled account flag", () => {
    expect(isSharedLogin({ app_metadata: { shared_dashboard_login: true } })).toBe(true);
    expect(isSharedLogin({ app_metadata: { shared_dashboard_login: "true" } })).toBe(false);
    expect(isSharedLogin(null)).toBe(false);
  });
  it("only selects roles assigned to the signed-in identity", () => {
    expect(selectedSharedRole("auth-1:student", "auth-1", ["student", "super_admin"])).toBe("student");
    expect(selectedSharedRole("auth-2:super_admin", "auth-1", ["super_admin"])).toBeNull();
    expect(selectedSharedRole("auth-1:super_admin", "auth-1", ["student"])).toBeNull();
    expect(selectedSharedRole(undefined, "auth-1", ["super_admin"])).toBeNull();
    expect(selectedSharedRole("auth-1:unknown", "auth-1", ["unknown"])).toBeNull();
  });
});
