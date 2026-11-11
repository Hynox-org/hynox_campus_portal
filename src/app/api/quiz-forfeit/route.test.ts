import { beforeEach, expect, it, vi } from "vitest";
import { forfeitQuizAttempt } from "@/services/learning";
import { POST } from "./route";
vi.mock("@/services/learning", () => ({ forfeitQuizAttempt: vi.fn() }));
const id = "11111111-1111-4111-8111-111111111111";
beforeEach(() => vi.clearAllMocks());
it("accepts a same-origin unload beacon", async () => {
  const response = await POST(new Request("http://localhost:3000/api/quiz-forfeit", { method: "POST", headers: { origin: "http://localhost:3000" }, body: JSON.stringify({ attemptId: id, reason: "tab_closed" }) }));
  expect(response.status).toBe(200); expect(forfeitQuizAttempt).toHaveBeenCalledWith(id, "tab_closed");
});
it("rejects a cross-origin forfeit before touching an attempt", async () => {
  const response = await POST(new Request("http://localhost:3000/api/quiz-forfeit", { method: "POST", headers: { origin: "https://other.example" }, body: JSON.stringify({ attemptId: id }) }));
  expect(response.status).toBe(403); expect(forfeitQuizAttempt).not.toHaveBeenCalled();
});
it.each(["broken", JSON.stringify({ attemptId: "bad" }), JSON.stringify({ attemptId: id, reason: "x".repeat(201) })])("rejects malformed unload requests", async body => {
  expect((await POST(new Request("http://localhost:3000/api/quiz-forfeit", { method: "POST", body }))).status).toBe(400);
  expect(forfeitQuizAttempt).not.toHaveBeenCalled();
});
