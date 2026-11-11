import { validateInstitutionId } from "./institution-validation";

type Input = Record<string, unknown>;
export function validateAcademicInput<T>(input: T, required: string[] = []): T {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid input.");
  const value = { ...input } as Input;
  for (const key of required) if (value[key] == null || value[key] === "") throw new Error(`${key} is required.`);
  for (const [key, field] of Object.entries(value)) {
    if (field === undefined) continue;
    if (key.endsWith("_id")) { if (field !== null && field !== "") validateInstitutionId(field as string); }
    if (["title", "name", "code", "slug"].includes(key)) {
      if (typeof field !== "string" || !field.trim() || field.trim().length > 200) throw new Error(`Invalid ${key}.`);
      value[key] = field.trim();
    }
    if (key === "slug" && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(value[key]))) throw new Error("Invalid slug.");
    if (["position", "duration", "duration_minutes"].includes(key) &&
      (typeof field !== "number" || !Number.isSafeInteger(field) || field < (key === "position" ? 1 : 0))) throw new Error(`Invalid ${key}.`);
    if (["is_preview", "is_required"].includes(key) && typeof field !== "boolean") throw new Error(`Invalid ${key}.`);
    if (key === "status_code" && (typeof field !== "string" || !field.trim())) throw new Error("Invalid status.");
    if (key === "enrollment_mode" && !["open", "approval", "private", "institution_only"].includes(String(field))) throw new Error("Invalid enrollment mode.");
    if (["video_url", "external_url", "file_url"].includes(key) && field !== "" && field !== null) {
      let url: URL;
      try { url = new URL(field as string); } catch { throw new Error(`Invalid ${key}.`); }
      if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error(`Invalid ${key}.`);
    }
    if (["start_date", "end_date", "due_date"].includes(key) && field !== "" && field !== null) {
      if (typeof field !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(field) || new Date(field).toISOString().slice(0, 10) !== field) throw new Error(`Invalid ${key}.`);
    }
    if (key === "content_json" && (field === null || typeof field !== "object" || Array.isArray(field))) throw new Error("Invalid lesson content.");
    if (key === "content_json" && field && typeof field === "object") {
      for (const content of ["text", "body"]) {
        const text = (field as Input)[content];
        if (text !== undefined && (typeof text !== "string" || text.length > 2_000_000)) throw new Error("Lesson text must be text under 2 MB.");
      }
    }
  }
  const end = value.end_date || value.due_date;
  if (value.resource_type && !value.external_url && !value.file_url) throw new Error("A resource URL is required.");
  if (value.start_date && end && String(value.start_date) > String(end)) throw new Error("Start date must not follow end date.");
  return value as T;
}

export function validateAssignmentIds(id: string, ids: unknown): asserts ids is string[] {
  validateInstitutionId(id);
  if (!Array.isArray(ids) || ids.length > 100) throw new Error("Choose at most 100 instructors.");
  ids.forEach(value => validateInstitutionId(value));
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate instructor IDs.");
}
