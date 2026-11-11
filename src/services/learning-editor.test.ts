import { beforeEach, expect, it, vi } from "vitest";
import { createClient } from "@/utils/supabase/server";
import { saveActivity, assignActivity, requireActivityEditor } from "./learning-editor";
vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));
const rpc = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createClient).mockResolvedValue({ schema: () => ({ rpc }) } as never);
});
it("sends the entire publication bundle to one transaction", async () => {
  const input = { title: "Quiz", questions: [{ question_text: "A?" }], assignments: [{ cohort_id: "cohort" }] };
  rpc.mockResolvedValue({ data: { id: "activity", title: "Quiz", lesson_id: "lesson" }, error: null });
  await saveActivity(null, input);
  expect(rpc).toHaveBeenCalledExactlyOnceWith("save_activity", { p_id: null, p_input: input });
});
it("does not report success when publication rolls back", async () => {
  rpc.mockResolvedValue({ data: null, error: new Error("Invalid assignment dates") });
  await expect(saveActivity(null, { title: "Quiz" })).rejects.toThrow("Invalid assignment dates");
  expect(rpc).toHaveBeenCalledTimes(1);
});
it("does not silently succeed on an empty assignment response", async () => {
  rpc.mockResolvedValue({ data: null, error: null });
  await expect(assignActivity({})).rejects.toThrow("not confirmed");
});
it("denies the editor unless database authority is explicitly true", async () => {
  rpc.mockResolvedValue({ data: false, error: null });
  await expect(requireActivityEditor("11111111-1111-4111-8111-111111111111")).rejects.toThrow("Access denied");
});
