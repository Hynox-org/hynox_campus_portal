/** Course averages have equal course weight; incomplete work must never round to 100%. */
export function averageLearningProgress(percentages: readonly number[]) {
  if (!percentages.length) return 0;
  if (percentages.some(value => !Number.isFinite(value) || value < 0 || value > 100)) throw new Error("Invalid learning progress percentage.");
  const average = Math.round(percentages.reduce((sum, value) => sum + value, 0) / percentages.length * 100) / 100;
  return percentages.every(value => value === 100) ? 100 : Math.min(99.99, average);
}
