/** Normalize thrown Error and database error objects without assuming their shape. */
export function errorMessage(error: unknown, fallback = "Something went wrong."): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string" && error.message) return error.message;
  return fallback;
}
