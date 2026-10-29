/** Keep correctness tied to the original input row when blank options are removed. */
export function quizOptions(texts: string[], correctIndices: number[]) {
  return texts.map((text, index) => ({ optionText: text.trim(), isCorrect: correctIndices.includes(index), position: index + 1 }))
    .filter(option => option.optionText);
}
