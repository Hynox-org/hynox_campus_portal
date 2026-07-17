"use server";

import { getCurrentUser } from "@/services/auth";
import { 
  createInstitution, 
  assignInstitutionAdmin,
  listInstitutionUsers,
  listTeacherInstitutions,
  listAllTeachers,
  mapTeacherToTenant,
  unmapTeacherFromTenant,
  updateInstitutionStatus,
  updateInstitution,
  getInstitutionRelationsCount,
  deleteInstitution
} from "@/services/institution";
import { 
  processCsvOnboarding,
  listOnboardingInvitations,
  regenerateInvitation,
  onboardSingleUser,
  onboardSuperAdmin
} from "@/services/onboarding";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

export async function createNewInstitutionAction(formData: FormData) {
  const name = formData.get("name") as string;
  const code = formData.get("code") as string;
  const type = formData.get("type") as string;
  const email = formData.get("email") as string;
  const phone = formData.get("phone") as string;
  const address = formData.get("address") as string;
  const website = formData.get("website") as string;

  if (!name || !code || !type) {
    return { error: "Name, code, and type are required." };
  }

  try {
    const userDetails = await getCurrentUser();
    if (!userDetails || userDetails.primaryRole !== "super_admin") {
      return { error: "Access denied. Only super administrators can perform this action." };
    }

    const institution = await createInstitution({
      name,
      institution_code: code,
      institution_type: type,
      email,
      phone,
      address,
      website,
      created_by: userDetails.user.id,
    });

    revalidatePath("/admin");
    return { success: true, institution };
  } catch (error: any) {
    return { error: error.message || "Failed to create institution." };
  }
}

export async function assignAdminAction(institutionId: string, email: string) {
  if (!institutionId || !email) {
    return { error: "Institution ID and admin email are required." };
  }

  try {
    const userDetails = await getCurrentUser();
    if (!userDetails || userDetails.primaryRole !== "super_admin") {
      return { error: "Access denied." };
    }

    await assignInstitutionAdmin(institutionId, email, userDetails.user.id);
    revalidatePath("/admin");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Failed to assign administrator." };
  }
}

export async function uploadCsvOnboardingAction(institutionId: string, csvContent: string) {
  if (!institutionId || !csvContent) {
    return { error: "Institution ID and CSV content are required." };
  }

  try {
    const userDetails = await getCurrentUser();
    if (!userDetails) return { error: "Access denied." };

    const isSuperAdmin = userDetails.primaryRole === "super_admin";
    const isInstAdmin = userDetails.primaryRole === "institution_admin" && userDetails.tenantId === institutionId;

    if (!isSuperAdmin && !isInstAdmin) {
      return { error: "Access denied. Insufficient permissions." };
    }

    const results = await processCsvOnboarding(csvContent, institutionId, userDetails.user.id);
    revalidatePath("/admin");
    revalidatePath("/institution");
    return { success: true, results };
  } catch (error: any) {
    return { error: error.message || "Failed to process CSV onboarding." };
  }
}

export async function listInvitationsAction() {
  try {
    const userDetails = await getCurrentUser();
    if (!userDetails) return { error: "Access denied." };

    const isSuperAdmin = userDetails.primaryRole === "super_admin";
    const isInstAdmin = userDetails.primaryRole === "institution_admin";

    if (!isSuperAdmin && !isInstAdmin) {
      return { error: "Access denied." };
    }

    let invitations = await listOnboardingInvitations();
    if (isInstAdmin) {
      // Scope to their own tenant
      invitations = invitations.filter((inv: any) => inv.tenant_id === userDetails.tenantId);
    }
    return { success: true, invitations };
  } catch (error: any) {
    return { error: error.message || "Failed to list invitations." };
  }
}

export async function regenerateInvitationAction(invitationId: string) {
  if (!invitationId) {
    return { error: "Invitation ID is required." };
  }

  try {
    const userDetails = await getCurrentUser();
    if (!userDetails) return { error: "Access denied." };

    const isSuperAdmin = userDetails.primaryRole === "super_admin";
    const isInstAdmin = userDetails.primaryRole === "institution_admin";

    if (!isSuperAdmin && !isInstAdmin) {
      return { error: "Access denied." };
    }

    // If institution_admin, we must verify the invitation belongs to their institution
    if (isInstAdmin) {
      const allInvites = await listOnboardingInvitations();
      const invite = allInvites.find((i: any) => i.id === invitationId);
      if (!invite || invite.tenant_id !== userDetails.tenantId) {
        return { error: "Access denied. Scoped invitation not found." };
      }
    }

    const res = await regenerateInvitation(invitationId, userDetails.user.id);
    revalidatePath("/admin");
    revalidatePath("/institution");
    return { success: true, invitation: res };
  } catch (error: any) {
    return { error: error.message || "Failed to regenerate invitation." };
  }
}

export async function listInstitutionUsersAction(institutionId: string) {
  if (!institutionId) {
    return { error: "Institution ID is required." };
  }

  try {
    const userDetails = await getCurrentUser();
    if (!userDetails) return { error: "Access denied." };

    const isSuperAdmin = userDetails.primaryRole === "super_admin";
    const isInstAdmin = userDetails.primaryRole === "institution_admin" && userDetails.tenantId === institutionId;

    if (!isSuperAdmin && !isInstAdmin) {
      return { error: "Access denied." };
    }

    const users = await listInstitutionUsers(institutionId);
    return { success: true, users };
  } catch (error: any) {
    return { error: error.message || "Failed to list institution users." };
  }
}

async function checkEmailRoleConflict(email: string, targetRole: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: existingUser } = await supabase
    .schema("core")
    .from("users")
    .select(`
      id,
      user_roles (
        role:role_id (
          name
        )
      )
    `)
    .eq("email", email)
    .maybeSingle();

  if (existingUser && existingUser.user_roles && existingUser.user_roles.length > 0) {
    const existingRoles = existingUser.user_roles.map((ur: any) => ur.role?.name.toLowerCase());
    const hasDifferentRole = existingRoles.some(r => r !== targetRole.toLowerCase());
    
    if (hasDifferentRole) {
      const rolesStr = existingRoles.map(r => r.toUpperCase()).join(", ");
      return `Conflict Warning: The email '${email}' is already registered with role(s): ${rolesStr}. It cannot be onboarded for a different role: ${targetRole.toUpperCase()}.`;
    }
  }
  return null;
}

export async function onboardSingleUserAction(params: {
  email: string;
  name: string;
  role: string;
  institutionId?: string;
}) {
  const { email, name, role, institutionId } = params;
  const isTeacher = role === "teacher" || role === "trainer";
  if (!email || !name || !role || (!isTeacher && !institutionId)) {
    return { error: "Required fields (email, name, role, and campus if not teacher) are missing." };
  }

  try {
    const userDetails = await getCurrentUser();
    if (!userDetails) return { error: "Access denied." };

    const isSuperAdmin = userDetails.primaryRole === "super_admin";
    const isInstAdmin = !isTeacher && userDetails.primaryRole === "institution_admin" && userDetails.tenantId === institutionId;

    if (!isSuperAdmin && !isInstAdmin) {
      return { error: "Access denied." };
    }

    const conflictMsg = await checkEmailRoleConflict(email, role);
    if (conflictMsg) {
      return { error: conflictMsg };
    }

    const result = await onboardSingleUser({
      email,
      name,
      role,
      institutionId,
      invitedByUserId: userDetails.user.id,
    });

    revalidatePath("/admin");
    revalidatePath("/institution");
    return { success: true, result };
  } catch (error: any) {
    return { error: error.message || "Failed to onboard user." };
  }
}
export async function listTeacherInstitutionsAction(userId: string) {
  try {
    const userDetails = await getCurrentUser();
    if (!userDetails) return { error: "Unauthorized." };

    const isSuperAdmin = userDetails.primaryRole === "super_admin";
    const data = await listTeacherInstitutions(userId, isSuperAdmin);
    return { success: true, institutions: data };
  } catch (error: any) {
    return { error: error.message || "Failed to list teacher institutions." };
  }
}

export async function listAllTeachersAction() {
  try {
    const userDetails = await getCurrentUser();
    if (!userDetails || userDetails.primaryRole !== "super_admin") {
      return { error: "Access denied." };
    }

    const teachers = await listAllTeachers();
    return { success: true, teachers };
  } catch (error: any) {
    return { error: error.message || "Failed to list teachers." };
  }
}

export async function mapTeacherToInstitutionAction(userId: string, tenantId: string) {
  try {
    const userDetails = await getCurrentUser();
    if (!userDetails || userDetails.primaryRole !== "super_admin") {
      return { error: "Access denied." };
    }

    await mapTeacherToTenant(userId, tenantId);
    revalidatePath("/admin");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Failed to map teacher to institution." };
  }
}

export async function unmapTeacherFromInstitutionAction(userId: string, tenantId: string) {
  try {
    const userDetails = await getCurrentUser();
    if (!userDetails || userDetails.primaryRole !== "super_admin") {
      return { error: "Access denied." };
    }

    await unmapTeacherFromTenant(userId, tenantId);
    revalidatePath("/admin");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Failed to unmap teacher from institution." };
  }
}

export async function getTeacherInstitutionDetailsAction(userId: string) {
  try {
    const userDetails = await getCurrentUser();
    if (!userDetails || userDetails.primaryRole !== "super_admin") {
      return { error: "Access denied." };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .rpc("get_teacher_institutions_and_programs", { p_teacher_id: userId });

    if (error) throw error;
    return { success: true, details: data || [] };
  } catch (error: any) {
    return { error: error.message || "Failed to retrieve teacher institution details." };
  }
}

export async function updateInstitutionStatusAction(institutionId: string, status: string) {
  try {
    const userDetails = await getCurrentUser();
    if (!userDetails || userDetails.primaryRole !== "super_admin") {
      return { error: "Access denied. Only super administrators can update institution status." };
    }

    await updateInstitutionStatus(institutionId, status);
    revalidatePath("/admin");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Failed to update institution status." };
  }
}

export async function onboardSuperAdminAction(params: {
  email: string;
  name: string;
}) {
  const { email, name } = params;
  if (!email || !name) {
    return { error: "Full Name and Email are required." };
  }

  try {
    const userDetails = await getCurrentUser();
    if (!userDetails || userDetails.primaryRole !== "super_admin") {
      return { error: "Access denied." };
    }

    const conflictMsg = await checkEmailRoleConflict(email, "super_admin");
    if (conflictMsg) {
      return { error: conflictMsg };
    }

    const result = await onboardSuperAdmin({
      email,
      name,
      invitedByUserId: userDetails.user.id,
    });

    revalidatePath("/admin");
    return { success: true, result };
  } catch (error: any) {
    return { error: error.message || "Failed to onboard super admin." };
  }
}

export async function updateInstitutionAction(institutionId: string, data: {
  name: string;
  institution_code: string;
  institution_type: string;
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
  logo_url?: string;
  status: string;
}) {
  try {
    const userDetails = await getCurrentUser();
    if (!userDetails || userDetails.primaryRole !== "super_admin") {
      return { error: "Access denied." };
    }

    const institution = await updateInstitution(institutionId, data);
    revalidatePath("/admin");
    return { success: true, institution };
  } catch (error: any) {
    return { error: error.message || "Failed to update institution." };
  }
}

export async function getInstitutionRelationsCountAction(institutionId: string) {
  try {
    const userDetails = await getCurrentUser();
    if (!userDetails || userDetails.primaryRole !== "super_admin") {
      return { error: "Access denied." };
    }

    const counts = await getInstitutionRelationsCount(institutionId);
    return { success: true, counts };
  } catch (error: any) {
    return { error: error.message || "Failed to check institution relations." };
  }
}

export async function deleteInstitutionAction(institutionId: string) {
  try {
    const userDetails = await getCurrentUser();
    if (!userDetails || userDetails.primaryRole !== "super_admin") {
      return { error: "Access denied." };
    }

    await deleteInstitution(institutionId);
    revalidatePath("/admin");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Failed to delete institution." };
  }
}

export async function deleteUserAction(userId: string) {
  try {
    const userDetails = await getCurrentUser();
    if (!userDetails || userDetails.primaryRole !== "super_admin") {
      return { error: "Access denied." };
    }

    const supabase = await createClient();

    // 1. Fetch user to check if they exist
    const { data: user } = await supabase
      .schema("core")
      .from("users")
      .select("id, email, auth_user_id")
      .eq("id", userId)
      .maybeSingle();

    if (!user) {
      return { error: "User not found." };
    }

    // 2. Delete invitation records first
    await supabase
      .schema("core")
      .from("user_invitations")
      .delete()
      .eq("user_id", userId);

    // 3. Delete user roles
    await supabase
      .schema("core")
      .from("user_roles")
      .delete()
      .eq("user_id", userId);

    // 4. Delete user record from core.users
    const { error: deleteUserErr } = await supabase
      .schema("core")
      .from("users")
      .delete()
      .eq("id", userId);

    if (deleteUserErr) throw deleteUserErr;

    // 5. Delete the underlying auth provider identity so the person can't
    // sign back in and silently reclaim their old roles/history.
    if (user.auth_user_id) {
      const adminClient = createAdminClient();
      const { error: deleteAuthErr } = await adminClient.auth.admin.deleteUser(
        user.auth_user_id
      );

      if (deleteAuthErr && deleteAuthErr.status !== 404) {
        throw deleteAuthErr;
      }
    }

    revalidatePath("/admin");
    revalidatePath("/institution");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Failed to delete user completely." };
  }
}


