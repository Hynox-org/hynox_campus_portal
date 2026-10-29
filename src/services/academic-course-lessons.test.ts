import { expect, it, vi } from "vitest";
vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));
import { createClient } from "@/utils/supabase/server";
import { listLessonsForCourse } from "./academic";

it("keeps module order before lesson position when flattening a course", async () => {
  const responses = [
    { data: [{ id: "module-a" }, { id: "module-b" }], error: null },
    { data: [{ id: "b1", module_id: "module-b", position: 1 }, { id: "a1", module_id: "module-a", position: 1 }, { id: "a2", module_id: "module-a", position: 2 }], error: null },
  ];
  const orders: string[] = [];
  vi.mocked(createClient).mockResolvedValue({ schema: () => ({ from: () => {
    const response = responses.shift();
    const query = { select: () => query, eq: () => query, is: () => query, in: () => query,
      order: (column: string) => { orders.push(column); return query; },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(response).then(resolve) };
    return query;
  } }) } as never);
  expect((await listLessonsForCourse("course")).map(lesson => lesson.id)).toEqual(["a1", "a2", "b1"]);
  expect(orders).toEqual(["position", "id", "position", "id"]);
});
