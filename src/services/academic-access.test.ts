import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("./auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("./institution-access", () => ({ requireInstitutionAccess: vi.fn() }));
import { createClient } from "@/utils/supabase/server";
import { getCurrentUser } from "./auth";
import { requireInstitutionAccess } from "./institution-access";
import { academicScope, requireAcademicWrite, requireCampusWrite, deliveryCohortIds, requireAcademicRead } from "./academic-access";
const campus = "11111111-1111-4111-8111-111111111111";
const program = "22222222-2222-4222-8222-222222222222";
const course = "33333333-3333-4333-8333-333333333333";
const moduleId = "44444444-4444-4444-8444-444444444444";
const cohort = "55555555-5555-4555-8555-555555555555";
type Row = Record<string, unknown>;
let tables: Record<string, Row[]>;
let current: { user: { id: string }; primaryRole: string; tenantId: string | null };
beforeEach(() => {
  vi.clearAllMocks();
  current = { user: { id: "teacher" }, primaryRole: "teacher", tenantId: null };
  vi.mocked(getCurrentUser).mockImplementation(async () => current as never);
  vi.mocked(requireInstitutionAccess).mockImplementation(async () => current as never);
  tables = {
    institutions: [{ id: campus, status: "active" }],
    programs: [{ id: program, tenant_id: campus, institution_id: campus, status_id: "active", deleted_at: null }],
    courses: [{ id: course, program_id: program, tenant_id: campus, institution_id: campus, status_id: "active", deleted_at: null }],
    modules: [{ id: moduleId, course_id: course, tenant_id: campus, institution_id: campus, status_id: "active", deleted_at: null }],
    cohorts: [{ id: cohort, tenant_id: campus, deleted_at: null }],
    cohort_teachers: [{ teacher_id: "teacher", cohort_id: cohort }],
    course_assignments: [{ id: "assignment", cohort_id: cohort, course_id: course, deleted_at: null }],
    course_instructors: [], statuses: [{ id: "active", code: "active" }], visibility_types: [{ id: "private", code: "private" }],
    enrollments: [{ user_id: "student", cohort_id: cohort, status_code: "active", deleted_at: null }],
  };
  vi.mocked(createClient).mockResolvedValue({ schema: () => ({ from: (table: string) => {
    const filters: Array<(row: Row) => boolean> = [];
    const result = () => (tables[table] || []).filter(row => filters.every(test => test(row)));
    const query = { select: () => query, limit: () => query,
      eq: (key: string, value: unknown) => { if (!key.includes(".")) filters.push(row => row[key] === value); return query; },
      is: (key: string, value: unknown) => { if (!key.includes(".")) filters.push(row => row[key] === value); return query; },
      in: (key: string, values: unknown[]) => { filters.push(row => values.includes(row[key])); return query; },
      single: async () => ({ data: result()[0], error: null }), maybeSingle: async () => ({ data: result()[0], error: null }),
      then: (resolve: (value: unknown) => void) => resolve({ data: result(), error: null }),
    };
    return query;
  } }) } as never);
});
it("allows a standalone cohort teacher to edit their assigned curriculum", async () => {
  expect(await requireAcademicWrite("modules", moduleId)).toMatchObject({ courseId: course, tenantId: campus });
});
it("does not allow a teacher to manage the program or instructor assignments", async () => {
  await expect(requireAcademicWrite("courses", course, true)).rejects.toThrow("Access denied");
});
it("rejects an unassigned teacher", async () => {
  tables.cohort_teachers = [];
  await expect(requireAcademicWrite("modules", moduleId)).rejects.toThrow("Access denied");
});
it("rejects a mismatched child campus and a deleted ancestor", async () => {
  tables.modules[0].tenant_id = program;
  await expect(academicScope("modules", moduleId)).rejects.toThrow("hierarchy");
  tables.modules[0].tenant_id = campus;
  tables.programs[0].deleted_at = "2026-10-27";
  await expect(academicScope("modules", moduleId)).rejects.toThrow("no longer exists");
});
it.each(["student", "public"])("rejects %s writes even inside their own campus", async primaryRole => {
  current.primaryRole = primaryRole; current.tenantId = campus;
  await expect(requireCampusWrite(campus)).rejects.toThrow("Access denied");
});
it("allows only the institution administrator's own campus", async () => {
  current.primaryRole = "institution_admin";
  await expect(requireCampusWrite(campus)).rejects.toThrow("Access denied");
  current.tenantId = campus;
  await expect(requireCampusWrite(campus)).resolves.toBeTruthy();
});
it("filters cohort scope by actual teacher assignment", async () => {
  expect(await deliveryCohortIds(campus)).toEqual([cohort]);
  tables.cohort_teachers = [];
  expect(await deliveryCohortIds(campus)).toEqual([]);
});
it("rejects private and draft ancestors for a student", async () => {
  current = { user: { id: "student" }, primaryRole: "student", tenantId: campus };
  await expect(requireAcademicRead("modules", moduleId)).resolves.toBeTruthy();
  tables.programs[0].visibility_type_id = "private";
  await expect(requireAcademicRead("modules", moduleId)).rejects.toThrow("unavailable");
  delete tables.programs[0].visibility_type_id;
  tables.programs[0].status_id = "draft";
  await expect(requireAcademicRead("modules", moduleId)).rejects.toThrow("unavailable");
});
