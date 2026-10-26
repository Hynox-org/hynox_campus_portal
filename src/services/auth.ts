import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { isSharedLogin, selectedSharedRole, SHARED_ROLE_COOKIE } from "@/lib/shared-login";

export interface UserDetails {
  authUser: any;
  user: any;
  primaryRole: string;
  tenantId: string | null;
  institution: any | null;
  sharedLogin?: boolean;
  availableRoles?: string[];
}

export async function getCurrentUser(): Promise<UserDetails | null> {
  const supabase = await createClient();

  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authUser) {
    return null;
  }

  // Resolve business user from core.users (bypassing public views)
  const { data: user, error: userError } = await supabase
    .schema("core")
    .from("users")
    .select("*")
    .eq("auth_user_id", authUser.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (userError) return null;
  if (!user) {
    // If auth user exists but is not pre-provisioned in core.users, fallback to public role
    return {
      authUser,
      user: null,
      primaryRole: "public",
      tenantId: null,
      institution: null,
    };
  }

  if (user.auth_user_id !== authUser.id || user.status !== "active") return null;

  // Resolve all roles mapped to user to select the one with highest priority
  const [roleResult, institutionResult] = await Promise.all([
    supabase
    .schema("core")
    .from("user_roles")
    .select(`
      role_id,
      roles:role_id (
        name,
        priority
      )
    `)
    .eq("user_id", user.id),
    user.tenant_id
      ? supabase.schema("institution").from("institutions").select("*").eq("id", user.tenant_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  const { data: userRoles, error: rolesError } = roleResult;

  if (rolesError || !userRoles?.length) return null;

  let primaryRole = "public";
  if (userRoles && userRoles.length > 0) {
    let maxPriority = -1;
    userRoles.forEach(ur => {
      const role = ur.roles as unknown as { name: string; priority: number } | null;
      if (role && role.priority > maxPriority) {
        maxPriority = role.priority;
        primaryRole = role.name;
      }
    });
  }

  // Fetch tenant/institution details if tenant_id is linked
  const availableRoles = (userRoles || []).flatMap(ur => {
    const role = ur.roles as unknown as { name: string } | null;
    return role?.name ? [role.name] : [];
  });
  const sharedLogin = isSharedLogin(authUser);
  if (sharedLogin) {
    primaryRole = selectedSharedRole((await cookies()).get(SHARED_ROLE_COOKIE)?.value, authUser.id, availableRoles) || "public";
  }

  const institution = institutionResult.data;
  if (user.tenant_id && primaryRole !== "super_admin" && (institutionResult.error || !institution || ["inactive", "suspended"].includes(institution.status))) return null;

  return {
    authUser,
    user,
    primaryRole,
    tenantId: user.tenant_id,
    institution,
    sharedLogin,
    availableRoles,
  };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
