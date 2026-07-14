import { describe, expect, it } from "vitest";
import { seedAcademicListCaches, unwrapActionResult } from "./dashboard-query";

describe("dashboard query helpers", () => {
  it("turns server-action error payloads into query errors", () => {
    expect(() => unwrapActionResult({ error: "Supabase unavailable" })).toThrow("Supabase unavailable");
  });

  it("seeds matching program and course keys without overwriting deep module data", () => {
    const calls: Array<[unknown[], unknown]> = [];
    const client = { setQueryData: (key: unknown[], data: unknown) => calls.push([key, data]) };

    seedAcademicListCaches(client as never, "institution-1", {
      programs: [{ id: "program-1" }],
      courses: [
        { program_id: "program-1" },
        { program_id: "program-2" },
      ],
    });

    expect(calls).toEqual([
      [["programs", "institution-1"], [{ id: "program-1" }]],
      [["courses", "program-1"], [{ program_id: "program-1" }]],
      [["courses", "program-2"], [{ program_id: "program-2" }]],
    ]);
    expect(calls.some(([key]) => key[0] === "course-modules")).toBe(false);
  });
});
