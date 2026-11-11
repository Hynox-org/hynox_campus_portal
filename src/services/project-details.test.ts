import { beforeEach, expect, it, vi } from "vitest";
import { createClient } from "@/utils/supabase/server";
import { getProjectDetails } from "./learning";
vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("./academic-access", () => ({ requireStudentRead: vi.fn() }));
const responses = new Map<string, { data: object | null; error: Error | null }>();
beforeEach(() => {
  responses.clear();
  responses.set("projects", { data: { id: "project" }, error: null });
  responses.set("project_submissions", { data: { id: "submission" }, error: null });
  responses.set("project_reviews", { data: { feedback: "Visible feedback" }, error: null });
  vi.mocked(createClient).mockResolvedValue({ schema: () => ({ from: (table: string) => {
    const query = { select: () => query, eq: () => query, maybeSingle: async () => responses.get(table) };
    return query;
  } }) } as never);
});
it.each(["project_submissions", "project_reviews"])("does not hide %s failures behind an unlocked or unreviewed Student form", async table => {
  responses.set(table, { data: null, error: new Error("temporarily unavailable") });
  await expect(getProjectDetails("activity", "student")).rejects.toThrow("temporarily unavailable");
});
it("returns the stored review unchanged", async () => {
  expect(await getProjectDetails("activity", "student")).toMatchObject({ review: { feedback: "Visible feedback" } });
});
