import { expect, it } from "vitest";
import { isPassedQuizAttempt, canApproveQuizRetake } from "./quiz-result";
it("uses the persisted verdict when question points and activity points use different scales", () => {
  expect(isPassedQuizAttempt({ passed: true, submitted_at: "2026-10-29" })).toBe(true);
  expect(isPassedQuizAttempt({ passed: false, submitted_at: "2026-10-29" })).toBe(false);
});
it("allows a closed failed quiz to request approval even when it was not forfeited", () => {
  expect(canApproveQuizRetake({ passed: false, submitted_at: "2026-10-29", forfeited: false })).toBe(true);
  expect(canApproveQuizRetake({ passed: false, submitted_at: "2026-10-29", forfeited: true })).toBe(true);
  expect(canApproveQuizRetake({ passed: true, submitted_at: "2026-10-29" })).toBe(false);
  expect(canApproveQuizRetake({ passed: null, submitted_at: null })).toBe(false);
});
it("does not mark an unfinished or forfeited attempt as passed", () => {
  expect(isPassedQuizAttempt({ passed: null, submitted_at: null })).toBe(false);
  expect(isPassedQuizAttempt({ passed: true, submitted_at: null })).toBe(false);
  expect(isPassedQuizAttempt({ passed: true, submitted_at: "2026-10-29", forfeited: true })).toBe(false);
  expect(isPassedQuizAttempt(null)).toBe(false);
});
