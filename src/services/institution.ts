import { createClient } from "@/utils/supabase/server";

export async function createInstitution(data: {
  name: string;
  slug: string;
  institution_code: string;
  institution_type: string;
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
  logo_url?: string;
  created_by?: string;
}) {
  const supabase = await createClient();

  const { data: institution, error } = await supabase
    .schema("institution")
    .from("institutions")
    .insert({
      name: data.name,
      slug: data.slug,
      institution_code: data.institution_code,
      institution_type: data.institution_type,
      email: data.email || null,
      phone: data.phone || null,
      address: data.address || null,
      website: data.website || null,
      logo_url: data.logo_url || null,
      status: "onboarding",
      created_by: data.created_by || null,
    })
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
  userEmail: string,
  assignedByUserId: string
) {
  const supabase = await createClient();

  // 1. Resolve business user by email
  const { data: user, error: userError } = await supabase
    .schema("core")
    .from("users")
    .select("id")
    .eq("email", userEmail)
    .maybeSingle();

  if (userError || !user) {
    throw new Error(
      userError?.message || `User with email ${userEmail} does not exist in core.users. Please onboard them first.`
    );
  }

  // 2. Link in institution_admins
  const { error: adminError } = await supabase
    .schema("institution")
    .from("institution_admins")
    .insert({
      institution_id: institutionId,
      user_id: user.id,
      assigned_by: assignedByUserId,
      role_scope: "primary",
    });

  if (adminError) {
    throw adminError;
  }

  // 3. Link user to tenant_id
  const { error: updateError } = await supabase
    .schema("core")
    .from("users")
    .update({ tenant_id: institutionId })
    .eq("id", user.id);

  if (updateError) {
    throw updateError;
  }

  // 4. Map user to 'institution_admin' role
  const { data: role } = await supabase
    .schema("core")
    .from("roles")
    .select("id")
    .eq("name", "institution_admin")
    .single();

  if (role) {
    await supabase
      .schema("core")
      .from("user_roles")
      .insert({
        user_id: user.id,
        role_id: role.id,
      })
      .maybeSingle();
  }

  return user;
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
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("core")
    .from("users")
    .select(`
      id,
      full_name,
      email,
      status,
      created_at,
      user_roles (
        role:role_id (
          name
        )
      )
    `)
    .eq("tenant_id", institutionId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map((u: any) => {
    const roles = u.user_roles?.map((ur: any) => ur.role?.name) || [];
    return {
      id: u.id,
      full_name: u.full_name,
      email: u.email,
      status: u.status,
      created_at: u.created_at,
      roles,
    };
  });
}

export async function listTeacherInstitutions(userId: string, isSuperAdmin: boolean) {
  const supabase = await createClient();

  if (isSuperAdmin) {
    return listInstitutions();
  }

  // 1. Get primary tenant_id
  const { data: primaryUser, error: userError } = await supabase
    .schema("core")
    .from("users")
    .select("tenant_id")
    .eq("id", userId)
    .maybeSingle();

  const primaryTenantId = primaryUser?.tenant_id;

  // 2. Get from course_instructors
  const { data: assignments, error: assignError } = await supabase
    .schema("academic")
    .from("course_instructors")
    .select("tenant_id")
    .eq("user_id", userId);

  if (assignError) throw assignError;

  // 3. Get from tenant_teachers
  const { data: tenantMappings, error: mapError } = await supabase
    .schema("academic")
    .from("tenant_teachers")
    .select("tenant_id")
    .eq("user_id", userId);

  if (mapError) throw mapError;

  const tIds = new Set<string>();
  if (primaryTenantId) tIds.add(primaryTenantId);
  assignments?.forEach(a => { if (a.tenant_id) tIds.add(a.tenant_id); });
  tenantMappings?.forEach(m => { if (m.tenant_id) tIds.add(m.tenant_id); });

  const tenantIds = Array.from(tIds);
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

  return (data || []).map((t: any) => ({
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
  const supabase = await createClient();
  const { error } = await supabase
    .schema("institution")
    .from("institutions")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", institutionId);
  if (error) throw error;
  return true;
}



