import { expect, it } from "vitest";
import { averageLearningProgress } from "./learning-progress";

it("does not turn an incomplete course into a completed program by rounding", () => {
  expect(averageLearningProgress([100, 99.99])).toBe(99.99);
  expect(averageLearningProgress([100, 100])).toBe(100);
  expect(averageLearningProgress([0, 50, 100])).toBe(50);
  expect(averageLearningProgress([])).toBe(0);
});
it.each([NaN, Infinity, -1, 100.01])("rejects corrupt progress values %s", value => {
  expect(() => averageLearningProgress([value])).toThrow("Invalid learning progress");
});
