/** The grading transaction owns the verdict; raw points can use a different scale. */
export function isPassedQuizAttempt(attempt: { passed?: boolean | null; submitted_at?: string | null; forfeited?: boolean } | null | undefined) {
  return attempt?.passed === true && !!attempt.submitted_at && !attempt.forfeited;
}

export function canApproveQuizRetake(attempt: { passed?: boolean | null; submitted_at?: string | null; forfeited?: boolean } | null | undefined) {
  return !!attempt?.submitted_at && !isPassedQuizAttempt(attempt);
}
