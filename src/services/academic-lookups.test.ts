import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));
import { createClient } from "@/utils/supabase/server";
import { getAcademicLookups } from "./academic";
const reads = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createClient).mockResolvedValue({ schema: () => ({ from: (table: string) => ({ select: () => ({ order: () => reads(table) }) }) }) } as never);
});
it("starts all independent lookup requests before waiting for any response", async () => {
  const responses: Array<(value: unknown) => void> = [];
  reads.mockImplementation(() => new Promise(resolve => responses.push(resolve)));
  const pending = getAcademicLookups();
  await vi.waitFor(() => expect(reads).toHaveBeenCalledTimes(4));
  responses.forEach((resolve, index) => resolve({ data: [{ code: `type-${index}` }], error: null }));
  expect(await pending).toEqual({ courseTypes: [{ code: "type-0" }], lessonTypes: [{ code: "type-1" }], statuses: [{ code: "type-2" }], visibilityTypes: [{ code: "type-3" }] });
});
it("surfaces a failed lookup instead of silently showing empty dropdowns", async () => {
  reads.mockImplementation((table: string) => Promise.resolve({ data: [], error: table === "lesson_types" ? new Error("Lookup unavailable") : null }));
  await expect(getAcademicLookups()).rejects.toThrow("Lookup unavailable");
});
