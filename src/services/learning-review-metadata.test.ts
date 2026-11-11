import { expect, it, vi } from "vitest";
import { createClient } from "@/utils/supabase/server";
import { listCohortProjectSubmissions, listProjectSubmissions } from "./learning";
vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("./institution-access", () => ({ requireInstitutionAccess: vi.fn() }));

it.each(["campus", "cohort"])("preserves the actual project passing score in the %s review list", async scope => {
  const data: Record<string, object[]> = {
    activity_assignments: [{ activity_id: "activity" }],
    projects: [{ id: "project", activity_id: "activity", max_score: 100, activities: { title: "QA Project", passing_score: 60 } }],
    project_submissions: [{ id: "submission", project_id: "project", student_id: "student" }], project_reviews: [], users: [],
  };
  vi.mocked(createClient).mockResolvedValue({ schema: () => ({ from: (table: string) => {
    const query = { select: () => query, eq: () => query, in: () => query, is: () => query, order: () => query, range: () => query,
      then: (resolve: (value: unknown) => void) => resolve({ data: data[table] || [], error: null }) };
    return query;
  } }) } as never);
  const rows = scope === "campus" ? await listProjectSubmissions("campus") : await listCohortProjectSubmissions("cohort");
  expect(rows[0]).toMatchObject({ max_score: 100, passing_score: 60 });
});
