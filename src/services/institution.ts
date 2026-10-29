import { createClient } from "@/utils/supabase/server";
import { validateInstitution, validateInstitutionId, institutionStatuses } from "@/lib/institution-validation";

export interface InstitutionUser {
  id: string;
  full_name: string | null;
  email: string;
  status: string;
  created_at: string;
  roles: string[];
}

export async function createInstitution(data: {
  name: string;
  institution_code: string;
  institution_type: string;
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
  logo_url?: string;
  created_by?: string;
}) {
  const validated = validateInstitution(data);
  const supabase = await createClient();
  const { data: institution, error } = await supabase.schema("institution").from("institutions")
    .insert({ ...validated, status: "onboarding", created_by: data.created_by || null })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return institution;
}

export async function listInstitutions() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("institution")
    .from("institutions")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data;
}

export async function assignInstitutionAdmin(
  institutionId: string,
  userEmail: string
) {
  const supabase = await createClient();
  const { data, error } = await supabase.schema("core").rpc("assign_onboarding_admin", {
    institution_id_value: institutionId, email_value: userEmail,
  });
  if (error || !data) throw new Error("Unable to assign administrator. Check the account and institution.");
  return { id: data };
}

export async function getInstitutionDetails(institutionId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("institution")
    .from("institutions")
    .select("*")
    .eq("id", institutionId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function listInstitutionUsers(institutionId: string) {
  validateInstitutionId(institutionId);
  const supabase = await createClient();
  const results: InstitutionUser[] = [];
  let cursor: {id:string;created_at:string}|undefined;
  for (;;) {
    let query = supabase.schema("core").from("users")
      .select("id,full_name,email,status,created_at,user_roles(role:role_id(name))")
      .eq("tenant_id",institutionId).is("deleted_at",null)
      .order("created_at",{ascending:false}).order("id",{ascending:false}).limit(500);
    if (cursor) query=query.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`);
    const {data,error}=await query;
    if (error) throw new Error("Unable to load institution users.");
    const users=(data || []) as unknown as Array<{id:string;full_name:string|null;email:string;status:string;created_at:string;user_roles:Array<{role:{name:string}|null}>|null}>;
    results.push(...users.map(user=>({id:user.id,full_name:user.full_name,email:user.email,status:user.status,created_at:user.created_at,
      roles:user.user_roles?.flatMap(link=>link.role?.name?[link.role.name]:[]) || []})));
    if (users.length<500) break;
    const last=users[users.length-1];cursor={id:last.id,created_at:last.created_at};
  }
  return results;
}

export async function listTeacherInstitutions(userId: string, isSuperAdmin: boolean) {
  const supabase = await createClient();

  if (isSuperAdmin) {
    return listInstitutions();
  }

  const { data: campuses, error: scopeError } = await supabase.schema("core")
    .rpc("teacher_campus_ids", { p_user_id: userId });
  if (scopeError) throw new Error("Unable to load teacher institutions.");
  const tenantIds = [...new Set((campuses || []) as string[])];
  if (tenantIds.length === 0) return [];

  const { data: insts, error: instError } = await supabase
    .schema("institution")
    .from("institutions")
    .select("*")
    .in("id", tenantIds)
    .order("name");

  if (instError) throw instError;
  return insts || [];
}

export async function listAllTeachers() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("get_all_teachers");

  if (error) throw error;

  return (data || []).map((t: { id: string; full_name: string; email: string; tenant_id: string | null; mapped_tenant_ids: string[] | null }) => ({
    id: t.id,
    full_name: t.full_name,
    email: t.email,
    tenant_id: t.tenant_id,
    mapped_tenant_ids: t.mapped_tenant_ids || []
  }));
}

export async function mapTeacherToTenant(userId: string, tenantId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .schema("academic")
    .from("tenant_teachers")
    .insert({ user_id: userId, tenant_id: tenantId });
  if (error) throw error;
  return true;
}

export async function unmapTeacherFromTenant(userId: string, tenantId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .schema("academic")
    .from("tenant_teachers")
    .delete()
    .eq("user_id", userId)
    .eq("tenant_id", tenantId);
  if (error) throw error;
  return true;
}

export async function updateInstitutionStatus(institutionId: string, status: string) {
  validateInstitutionId(institutionId);
  if (!institutionStatuses.includes(status)) throw new Error("Invalid institution status.");
  const supabase = await createClient();
  const { data, error } = await supabase.schema("institution").from("institutions")
    .update({ status, updated_at: new Date().toISOString() }).eq("id", institutionId).select("id").maybeSingle();
  if (error || !data) throw new Error("Institution could not be updated or access was denied.");
  return true;
}

export async function updateInstitution(
  institutionId: string,
  data: {
    name: string;
    institution_code: string;
    institution_type: string;
    email?: string;
    phone?: string;
    address?: string;
    website?: string;
    logo_url?: string;
    status: string;
  }
) {
  validateInstitutionId(institutionId);
  const validated = validateInstitution(data);
  const supabase = await createClient();
  const { data: institution, error } = await supabase.schema("institution").from("institutions")
    .update({ ...validated, updated_at: new Date().toISOString() }).eq("id", institutionId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return institution;
}

export async function getInstitutionRelationsCount(institutionId: string) {
  validateInstitutionId(institutionId);
  const supabase = await createClient();
  const [cohorts, programs, users] = await Promise.all([
    supabase.schema("delivery").from("cohorts").select("id",{count:"exact",head:true}).or(`institution_id.eq.${institutionId},tenant_id.eq.${institutionId}`),
    supabase.schema("academic").from("programs").select("id",{count:"exact",head:true}).or(`institution_id.eq.${institutionId},tenant_id.eq.${institutionId}`),
    supabase.schema("core").from("users").select("id",{count:"exact",head:true}).eq("tenant_id",institutionId),
  ]);
  if (cohorts.error || programs.error || users.error) throw new Error("Unable to check institution dependencies.");
  return {cohorts:cohorts.count || 0,programs:programs.count || 0,users:users.count || 0};
}

export async function deleteInstitution(institutionId: string) {
  validateInstitutionId(institutionId);
  const supabase = await createClient();
  const { data, error } = await supabase.schema("institution").rpc("delete_managed_institution", { institution_id_value: institutionId });
  if (error || !data) throw new Error("Institution could not be deleted. Remove its linked users, staff and learning records first.");
  return true;
}
