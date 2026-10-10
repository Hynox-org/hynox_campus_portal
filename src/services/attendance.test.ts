import { describe, expect, it, vi } from "vitest";
vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));
import { createClient } from "@/utils/supabase/server";
import { verifyAttendanceMarkingPermission } from "./attendance";

describe("attendance permissions", () => {
  function setup(assigned: boolean, teacherTenant: string | null) {
    vi.mocked(createClient).mockResolvedValue({ schema: () => ({ from: (table: string) => {
      let invalidColumn = false;
      const data = table === "cohort_teachers" ? assigned ? { id: "assignment" } : null
        : table === "cohorts" ? { institution_id: "campus-1" } : { tenant_id: teacherTenant };
      const query = {
        select: (columns: string) => { invalidColumn = table === "users" && columns.includes("institution_id"); return query; },
        eq: () => query,
        maybeSingle: async () => ({ data, error: null }),
        single: async () => ({ data: invalidColumn ? null : data, error: invalidColumn ? { message: "column users.institution_id does not exist" } : null }),
      };
      return query;
    } }) } as never);
  }
  it("allows a teacher explicitly assigned to a cohort even without a home tenant", async () => {
    setup(true, null);
    expect(await verifyAttendanceMarkingPermission("cohort-1", "teacher-1", "teacher")).toBe(true);
  });
  it("uses the actual tenant column for the institution-teacher fallback", async () => {
    setup(false, "campus-1");
    expect(await verifyAttendanceMarkingPermission("cohort-1", "teacher-1", "teacher")).toBe(true);
  });
  it("denies unassigned teachers from another institution", async () => {
    setup(false, "campus-2");
    expect(await verifyAttendanceMarkingPermission("cohort-1", "teacher-1", "teacher")).toBe(false);
  });
  it("denies students even when enrolled in the cohort", async () => {
    expect(await verifyAttendanceMarkingPermission("cohort-1", "student-1", "student")).toBe(false);
  });
});
