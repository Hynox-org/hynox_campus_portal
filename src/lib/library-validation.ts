import { validateInstitutionId } from "./institution-validation";

type BlueprintInput = Record<string, unknown>;

/** Validate the server boundary, including partial updates; never trust TS client types. */
export function validateBlueprintInput<T extends object>(input: T, kind: "course" | "module" | "lesson" | "resource", partial = false): T {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid blueprint details.");
  const result = { ...input } as BlueprintInput;
  const required = partial ? [] : ["title", ...(kind === "course" ? ["slug"] : [`${kind === "module" ? "course" : kind === "lesson" ? "module" : "lesson"}_template_id`])];
  for (const field of required) if (result[field] === undefined) throw new Error(`Missing ${field}.`);
  for (const [field, value] of Object.entries(result)) {
    if (value === undefined) continue;
    if (field.endsWith("_template_id")) validateInstitutionId(value as string);
    if (["title", "slug", "description", "category_code", "course_type_code", "lesson_type_code", "resource_type", "enrollment_mode", "thumbnail_path", "video_url", "file_url", "external_url"].includes(field)) {
      if (typeof value !== "string") throw new Error(`Invalid ${field}.`);
      const text = value.trim();
      if ((["title", "slug"].includes(field) && !text) || text.length > (field === "description" ? 20000 : field === "title" ? 300 : 2048) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) throw new Error(`Invalid ${field}.`);
      result[field] = text;
      if (["video_url", "file_url", "external_url", "thumbnail_path"].includes(field) && text) {
        let url: URL;
        try { url = new URL(text); } catch { throw new Error(`Invalid ${field} URL.`); }
        if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error(`Invalid ${field} URL.`);
      }
    }
    if (["position", "duration", "duration_minutes"].includes(field) && (!Number.isSafeInteger(value) || (value as number) < (field === "position" ? 1 : 0) || (value as number) > 2147483647)) throw new Error(`Invalid ${field}.`);
    if (["is_published", "is_preview"].includes(field) && typeof value !== "boolean") throw new Error(`Invalid ${field}.`);
  }
  if (result.slug !== undefined && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result.slug as string)) throw new Error("Slug must use lowercase letters, digits and single hyphens.");
  if (result.enrollment_mode !== undefined && !["open", "approval", "private", "institution_only"].includes(result.enrollment_mode as string)) throw new Error("Invalid enrollment mode.");
  if (result.lesson_type_code !== undefined && !["text", "video", "pdf"].includes(result.lesson_type_code as string)) throw new Error("Invalid library lesson type.");
  if (kind === "resource" && !partial) {
    if (!["link", "pdf", "zip", "doc"].includes(result.resource_type as string)) throw new Error("Invalid resource type.");
    if (!(result.file_url || result.external_url)) throw new Error("Resource URL is required.");
  }
  return result as T;
}
