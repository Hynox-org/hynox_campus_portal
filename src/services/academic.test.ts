import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));
import { createClient } from "@/utils/supabase/server";
import { getCourseInstructors } from "./academic";

describe("course teachers across schemas", () => {
  const usersRead = vi.fn();
  const assignmentsRead = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue({ schema: (schema: string) => ({ from: () => ({
      select: () => schema === "academic" ? { eq: assignmentsRead } : { in: usersRead },
    }) }) } as never);
  });
  it("matches users by ID while preserving assignment order and missing-user entries", async () => {
    assignmentsRead.mockResolvedValue({ data: [
      {user_id:"teacher-1",instructor_role:"primary"},
      {user_id:"teacher-2",instructor_role:"assistant"},
      {user_id:"hidden-user",instructor_role:"assistant"},
    ], error:null });
    usersRead.mockResolvedValue({data:[
      {id:"teacher-2",full_name:"Second",email:"second@example.com"},
      {id:"teacher-1",full_name:"First",email:"first@example.com"},
    ],error:null});
    const result = await getCourseInstructors("course-1");
    expect(result.map(i => i.user?.full_name)).toEqual(["First","Second",undefined]);
    expect(result[2].user).toBeNull();
    expect(result[0].instructor_role).toBe("primary");
  });
  it("avoids a user query for an empty course", async () => {
    assignmentsRead.mockResolvedValue({data:[],error:null});
    expect(await getCourseInstructors("empty-course")).toEqual([]);
    expect(usersRead).not.toHaveBeenCalled();
  });
  it("propagates user lookup errors instead of displaying an empty teacher list", async () => {
    assignmentsRead.mockResolvedValue({data:[{user_id:"teacher-1",instructor_role:"primary"}],error:null});
    usersRead.mockResolvedValue({data:null,error:new Error("User lookup unavailable")});
    await expect(getCourseInstructors("course-1")).rejects.toThrow("User lookup unavailable");
  });
});
