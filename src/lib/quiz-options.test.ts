import { expect, it } from "vitest";
import { quizOptions } from "./quiz-options";
it("does not shift the correct answer when an earlier option is blank", () => {
  expect(quizOptions([" ", "Wrong", " Right "], [2])).toEqual([
    { optionText: "Wrong", isCorrect: false, position: 2 }, { optionText: "Right", isCorrect: true, position: 3 },
  ]);
});
