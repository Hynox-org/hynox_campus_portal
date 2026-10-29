import { beforeEach, expect, it, vi } from "vitest";
import { createClient } from "@/utils/supabase/server";
import { startQuiz, finishQuiz, approveRetake, saveQuizQuestion, quizContent } from "./quiz-engine";
vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));
const quiz = "11111111-1111-4111-8111-111111111111";
const student = "22222222-2222-4222-8222-222222222222";
const id = "33333333-3333-4333-8333-333333333333";
const attempt = { id, quiz_id: quiz, student_id: student, student_activity_progress_id: id, attempt_number: 1,
  started_at: "2026-10-29T00:00:00Z", submitted_at: null, score: null, max_score: null, passed: null, forfeited: false };
const rpc = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({ data: attempt, error: null });
  vi.mocked(createClient).mockResolvedValue({ schema: () => ({ rpc }) } as never);
});
it("starts through one atomic RPC and leaves assignment and attempt counting to the database", async () => {
  expect(await startQuiz(quiz, student, "new")).toEqual(attempt);
  expect(rpc).toHaveBeenCalledExactlyOnceWith("start_quiz", { p_quiz_id: quiz, p_student_id: student, p_progress_id: null });
});
it.each(["bad-id", "", "new"])('rejects malformed quiz identifier "%s" before database work', async value => {
  await expect(startQuiz(value, student)).rejects.toThrow(/Invalid/);
  expect(rpc).not.toHaveBeenCalled();
});
it("does not accept a mismatched student or quiz in a response", async () => {
  rpc.mockResolvedValue({ data: { ...attempt, student_id: quiz }, error: null });
  await expect(startQuiz(quiz, student)).rejects.toThrow("Invalid quiz attempt response");
});
it("propagates assignment denial and does not fall back to unguarded inserts", async () => {
  rpc.mockResolvedValue({ data: null, error: new Error("No active quiz assignment") });
  await expect(startQuiz(quiz, student)).rejects.toThrow("No active quiz assignment");
  expect(rpc).toHaveBeenCalledTimes(1);
});
it("submits short text and multiple selections intact in one transaction", async () => {
  const answers = [{ questionId: id, answerText: "Campus" }, { questionId: quiz, selectedOptionId: student }];
  await finishQuiz(id, answers);
  expect(rpc).toHaveBeenCalledExactlyOnceWith("finish_quiz", { p_attempt_id: id, p_answers: answers, p_forfeit_reason: null });
});
it("rejects oversized text before transmitting it", async () => {
  await expect(finishQuiz(id, [{ questionId: quiz, answerText: "x".repeat(10001) }])).rejects.toThrow("Invalid answer text");
  expect(rpc).not.toHaveBeenCalled();
});
it("propagates a transaction failure during question replacement", async () => {
  rpc.mockResolvedValue({ data: null, error: new Error("This quiz already has attempts") });
  await expect(saveQuizQuestion(quiz, id, "Changed", "single_choice", 1, 1, [])).rejects.toThrow("already has attempts");
  expect(rpc).toHaveBeenCalledTimes(1);
});
it("requires an explicit successful retake approval response", async () => {
  rpc.mockResolvedValue({ data: null, error: null });
  await expect(approveRetake(id)).rejects.toThrow("not confirmed");
});
it("requests staff answer keys only through the guarded content RPC", async () => {
  rpc.mockResolvedValue({ data: { quiz: { id: quiz, activity_id: student }, attempt: null, questions: [] }, error: null });
  await quizContent(student, undefined, true);
  expect(rpc).toHaveBeenCalledExactlyOnceWith("quiz_content", { p_activity_id: student, p_attempt_id: null, p_staff: true });
});
