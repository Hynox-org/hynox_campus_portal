import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { read, utils } from "xlsx";
import { onboardingLink } from "@/lib/onboarding-link";

export interface OnboardingResult {
  email: string;
  status: "success" | "error";
  link?: string;
  error?: string;
  queued?: boolean;
}
export interface OnboardingRow { name: string; email: string; role: string; institution_id?: string }
export const MAX_ONBOARDING_ROWS = 2500;
const MAX_CSV_BYTES = 750_000;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const emailPattern = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const roles = ["student", "teacher", "trainer", "institution_admin", "mentor", "super_admin"];

export function parseCsv(csvContent: string): OnboardingRow[] {
  if (typeof csvContent !== "string" || Buffer.byteLength(csvContent, "utf8") > MAX_CSV_BYTES) {
    throw new Error("CSV must be text no larger than 750 KB.");
  }
  const workbook = read(csvContent, { type: "string", raw: true });
  if (!workbook.SheetNames.length) throw new Error("CSV is empty.");
  const lines = utils.sheet_to_json<string[]>(workbook.Sheets[workbook.SheetNames[0]], {
    header: 1, defval: "", blankrows: false, raw: true,
  });
  if (lines.length < 2) throw new Error("CSV must contain at least one user.");
  if (lines.length - 1 > MAX_ONBOARDING_ROWS) throw new Error("Upload at most 2500 users at a time.");
  const headers = lines[0].map(value => String(value).replace(/^\uFEFF/, "").trim().toLowerCase());
  const find = (aliases: string[]) => headers.findIndex(header => aliases.includes(header));
  const nameIndex = find(["name", "full name", "full_name"]);
  const emailIndex = find(["email", "email address", "email_address", "mail"]);
  const roleIndex = find(["role"]);
  const institutionIndex = find(["institution_id", "institution", "institution id"]);
  if (new Set(headers).size !== headers.length) throw new Error("CSV contains duplicate headers.");
  if (nameIndex < 0 || emailIndex < 0) throw new Error("CSV must contain 'Name' and 'Email' headers.");
  return lines.slice(1).map(line => ({
    name: String(line[nameIndex] ?? "").trim(),
    email: String(line[emailIndex] ?? "").trim().toLowerCase(),
    role: roleIndex < 0 ? "student" : String(line[roleIndex] || "student").trim().toLowerCase(),
    institution_id: institutionIndex < 0 ? undefined : String(line[institutionIndex] || "").trim() || undefined,
  }));
}

function normalizeRow(row: OnboardingRow, institutionId?: string): OnboardingRow {
  if (typeof row.name !== "string" || typeof row.email !== "string" || typeof row.role !== "string") throw new Error("Invalid onboarding fields.");
  const name = row.name.trim();
  const email = row.email.trim().toLowerCase();
  const role = row.role.trim().toLowerCase();
  if (!name || name.length > 200 || /[\u0000-\u001f\u007f]/.test(name)) throw new Error("Name must contain 1 to 200 characters without control characters.");
  if (email.length > 254 || !emailPattern.test(email)) throw new Error("Invalid email address.");
  if (!roles.includes(role)) throw new Error("Unsupported onboarding role.");
  const institution = ["teacher", "trainer", "super_admin"].includes(role) ? undefined : row.institution_id || institutionId;
  if (!["teacher", "trainer", "super_admin"].includes(role) && (!institution || !uuid.test(institution))) throw new Error("A valid institution ID is required.");
  return { name, email, role, institution_id: institution };
}

interface ProvisionedRow extends OnboardingResult { token?: string }
async function provisionRows(rows: OnboardingRow[], dedicatedSuper = false): Promise<OnboardingResult[]> {
  const supabase = await createClient();
  const results: OnboardingResult[] = [];
  for (let offset = 0; offset < rows.length; offset += 100) {
    const batch = rows.slice(offset, offset + 100);
    let data: unknown;
    let failed = false;
    try {
      const response = await supabase.schema("core").rpc("provision_onboarding", { rows: batch, dedicated_super: dedicatedSuper });
      data = response.data;
      failed = Boolean(response.error);
    } catch { failed = true; }
    if (failed || !Array.isArray(data) || data.length !== batch.length) {
      // Earlier batches are durable; re-import safely reuses their pending invitations.
      results.push(...rows.slice(offset).map(row => ({ email: row.email, status: "error" as const, error: "Batch could not be confirmed. Retry the import; existing invitations will be reused." })));
      break;
    }
    results.push(...(data as ProvisionedRow[]).map(row => ({
      email: row.email, status: row.status, error: row.error,
      queued: row.queued, link: row.status === "success" && row.token ? onboardingLink(row.token, row.email) : undefined,
    })));
  }
  return results;
}

export async function processCsvOnboarding(csvContent: string, selectedInstitutionId: string): Promise<OnboardingResult[]> {
  const rows = parseCsv(csvContent).map((row, index) => {
    try { return normalizeRow(row, selectedInstitutionId); }
    catch (error) { throw new Error(`CSV row ${index + 2}: ${error instanceof Error ? error.message : "Invalid fields."}`); }
  });
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.role === "super_admin") throw new Error("Use the dedicated super administrator invitation flow.");
    if (seen.has(row.email)) throw new Error("CSV contains duplicate email addresses.");
    seen.add(row.email);
  }
  return provisionRows(rows);
}

export async function onboardSingleUser(params: { email: string; name: string; role: string; institutionId?: string; invitedByUserId: string }): Promise<OnboardingResult> {
  try {
    const row = normalizeRow(params, params.institutionId);
    if (row.role === "super_admin") throw new Error("Use the dedicated super administrator invitation flow.");
    return (await provisionRows([row]))[0];
  } catch (error) {
    return { email: typeof params?.email === "string" ? params.email : "", status: "error", error: error instanceof Error ? error.message : "Unable to onboard user." };
  }
}

export async function onboardSuperAdmin(params: { email: string; name: string; invitedByUserId: string }): Promise<OnboardingResult> {
  try { return (await provisionRows([normalizeRow({ ...params, role: "super_admin" })], true))[0]; }
  catch (error) { return { email: params.email, status: "error", error: error instanceof Error ? error.message : "Unable to onboard administrator." }; }
}

export async function regenerateInvitation(invitationId: string) {
  if (!uuid.test(invitationId)) throw new Error("Invalid invitation ID.");
  const supabase = await createClient();
  const { data, error } = await supabase.schema("core").rpc("regenerate_onboarding", { invitation_id: invitationId });
  if (error || !data) throw new Error("Invitation could not be regenerated. It may be active, unavailable or currently being sent.");
  return { ...data, link: onboardingLink(data.token, data.email) };
}

interface InvitationUser { id: string; full_name: string; email: string; tenant_id: string | null; status: string; auth_user_id: string | null; deleted_at: string | null }
export async function verifyInvitation(token: string, email: string) {
  if (typeof token !== "string" || !uuid.test(token) || typeof email !== "string" || email.length > 254 || !emailPattern.test(email.trim())) {
    return { valid: false, error: "Invitation not found or invalid token." };
  }
  const supabase = createAdminClient();
  const { data: invitation, error } = await supabase.schema("core").from("user_invitations")
    .select("id,token,expires_at,status,invitation_type,user:user_id(id,full_name,email,tenant_id,status,auth_user_id,deleted_at)")
    .eq("token", token).maybeSingle();
  const user = invitation?.user as unknown as InvitationUser | null;
  if (error || !invitation || !user || user.email.toLowerCase() !== email.trim().toLowerCase()) return { valid: false, error: "Invitation not found or invalid token." };
  if (user.deleted_at || user.status !== "invited" || user.auth_user_id) return { valid: false, error: "Account is already activated or unavailable." };
  if (!["created", "pending", "sent"].includes(invitation.status)) return { valid: false, error: "Invitation is no longer available." };
  const expiresAt = Date.parse(invitation.expires_at);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return { valid: false, error: "Invitation token has expired." };
  let institutionName = "Hynox Campus";
  if (user.tenant_id) {
    const { data: institution, error: institutionError } = await supabase.schema("institution").from("institutions").select("name").eq("id", user.tenant_id).maybeSingle();
    if (institutionError || !institution) return { valid: false, error: "Invitation institution is unavailable." };
    institutionName = institution.name;
  }
  return { valid: true, invitation: { id: invitation.id, token: invitation.token, invitationType: invitation.invitation_type, fullName: user.full_name, email: user.email, institutionName } };
}

export async function listOnboardingInvitations() {
  const supabase = await createClient();
  const results = [];
  let cursor: { created_at: string; id: string } | undefined;
  for (;;) {
    let query = supabase.schema("core").from("user_invitations")
      .select("id,token,expires_at,accepted_at,status,invitation_type,created_at,tenant_id,mail_state,mail_attempts,user:user_id(id,full_name,email,status)")
      .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(500);
    if (cursor) query = query.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`);
    const { data, error } = await query;
    if (error) throw new Error("Unable to load onboarding invitations.");
    // PostgREST cannot embed this relationship across the core/institution schemas.
    const tenantIds = [...new Set((data || []).map(invitation => invitation.tenant_id).filter(Boolean))];
    const institutions = new Map<string, string>();
    if (tenantIds.length) {
      const { data: tenants, error: tenantError } = await supabase.schema("institution")
        .from("institutions").select("id,name").in("id", tenantIds);
      if (tenantError) throw new Error("Unable to load invitation institutions.");
      for (const tenant of tenants || []) institutions.set(tenant.id, tenant.name);
    }
    results.push(...(data || []).map(invitation => ({
      ...invitation,
      user: (Array.isArray(invitation.user) ? invitation.user[0] : invitation.user) || { id: "", full_name: null, email: "" },
      status: ["created", "pending", "sent"].includes(invitation.status) && Date.parse(invitation.expires_at) <= Date.now() ? "expired" : invitation.status,
      institution_name: invitation.tenant_id ? institutions.get(invitation.tenant_id) || "Unknown Institution" : "Global / Platform",
    })));
    if (!data || data.length < 500) break;
    const last = data[data.length - 1];
    cursor = { created_at: last.created_at, id: last.id };
  }
  return results;
}


