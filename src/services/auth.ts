import { createClient } from "@/utils/supabase/server";

export interface UserDetails {
  authUser: any;
  user: any;
  primaryRole: string;
  tenantId: string | null;
  institution: any | null;
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
  let { data: user, error: userError } = await supabase
    .schema("core")
    .from("users")
    .select("*")
    .eq("auth_user_id", authUser.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!user && authUser.email) {
    // Fallback: Resolve by email if auth_user_id link is not established yet
    const { data: emailUser } = await supabase
      .schema("core")
      .from("users")
      .select("*")
      .eq("email", authUser.email)
      .is("deleted_at", null)
      .maybeSingle();

    if (emailUser) {
      // Establish the link
      await supabase
        .schema("core")
        .from("users")
        .update({
          auth_user_id: authUser.id,
          status: "active",
          updated_at: new Date().toISOString()
        })
        .eq("id", emailUser.id);

      // Mark pending invitations as accepted
      await supabase
        .schema("core")
        .from("user_invitations")
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("user_id", emailUser.id)
        .in("status", ["created", "sent", "pending"]);

      // Set user claims in Supabase
      try {
        await supabase
          .schema("core")
          .rpc("set_user_role_claim", { target_user_id: authUser.id });
      } catch (rpcErr) {
        console.error("Failed to run set_user_role_claim rpc:", rpcErr);
      }

      // Update local reference
      emailUser.auth_user_id = authUser.id;
      emailUser.status = "active";
      user = emailUser;
    }
  }

  if (userError || !user) {
    // If auth user exists but is not pre-provisioned in core.users, fallback to public role
    // Phase 8 Rule: Ensure akshaykumar07.m@gmail.com is always super_admin
    const isSuperAdminEmail = authUser.email === "akshaykumar07.m@gmail.com";
    return {
      authUser,
      user: null,
      primaryRole: isSuperAdminEmail ? "super_admin" : "public",
      tenantId: null,
      institution: null,
    };
  }

  // Resolve all roles mapped to user to select the one with highest priority
  const { data: userRoles, error: rolesError } = await supabase
    .schema("core")
    .from("user_roles")
    .select(`
      role_id,
      roles:role_id (
        name,
        priority
      )
    `)
    .eq("user_id", user.id);

  let primaryRole = "public";
  if (!rolesError && userRoles && userRoles.length > 0) {
    let maxPriority = -1;
    userRoles.forEach((ur: any) => {
      const role = ur.roles;
      if (role && role.priority > maxPriority) {
        maxPriority = role.priority;
        primaryRole = role.name;
      }
    });
  }

  // Phase 8 Rule: Ensure akshaykumar07.m@gmail.com is always super_admin
  if (authUser.email === "akshaykumar07.m@gmail.com") {
    primaryRole = "super_admin";
  }

  // Fetch tenant/institution details if tenant_id is linked
  let institution = null;
  if (user.tenant_id) {
    const { data: instData } = await supabase
      .schema("institution")
      .from("institutions")
      .select("*")
      .eq("id", user.tenant_id)
      .maybeSingle();

    institution = instData;
  }

  return {
    authUser,
    user,
    primaryRole,
    tenantId: user.tenant_id,
    institution,
  };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
