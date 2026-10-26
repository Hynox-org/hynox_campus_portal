export const institutionIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const institutionStatuses = ["onboarding", "active", "inactive", "suspended"];

export function validateInstitutionId(value: string) {
  if (typeof value !== "string" || !institutionIdPattern.test(value)) throw new Error("Invalid institution or user ID.");
}

export function validateInstitution(data: {
  name: string; institution_code: string; institution_type: string;
  email?: string; phone?: string; address?: string; website?: string; logo_url?: string; status?: string;
}) {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid institution details.");
  const text = (value: unknown, max: number, required = false, multiline = false) => {
    if (value === undefined || value === null) { if (required) throw new Error("Required institution fields are missing."); return ""; }
    if (typeof value !== "string") throw new Error("Institution fields must be text.");
    const result = value.trim();
    const controls = multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/;
    if ((required && !result) || result.length > max || controls.test(result)) throw new Error("Institution field is empty, too long or contains control characters.");
    return result;
  };
  const name = text(data.name, 160, true);
  const institution_code = text(data.institution_code, 64, true).toUpperCase();
  if (!/^[A-Z0-9_-]+$/.test(institution_code)) throw new Error("Institution code may contain only letters, digits, hyphens and underscores.");
  const institution_type = text(data.institution_type, 30, true);
  if (!["school", "college", "others"].includes(institution_type)) throw new Error("Invalid institution type.");
  const email = text(data.email, 254).toLowerCase();
  if (email && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) throw new Error("Invalid institution email.");
  const url = (value?: string) => {
    const result = text(value, 2048);
    if (!result) return null;
    let parsed: URL;
    try { parsed = new URL(result); } catch { throw new Error("Institution links require a valid HTTP or HTTPS URL."); }
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error("Institution links require HTTP/HTTPS without embedded credentials.");
    return parsed.toString();
  };
  const status = data.status || "onboarding";
  if (!institutionStatuses.includes(status)) throw new Error("Invalid institution status.");
  return { name, institution_code, institution_type, email: email || null,
    phone: text(data.phone,40) || null, address: text(data.address,2000,false,true) || null,
    website: url(data.website), logo_url: url(data.logo_url), status };
}
