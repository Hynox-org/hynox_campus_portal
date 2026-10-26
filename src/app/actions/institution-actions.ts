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
  parseCsv,
  listOnboardingInvitations,
  regenerateInvitation,
  onboardSingleUser,
  onboardSuperAdmin
} from "@/services/onboarding";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { validateInstitutionId } from "@/lib/institution-validation";

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

    await assignInstitutionAdmin(institutionId, email);
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

    // Validate every row before any account or invitation is changed.
    for (const row of parseCsv(csvContent)) {
      const role = row.role.trim().toLowerCase();
      if (!["student", "institution_admin", "teacher", "trainer", "mentor"].includes(role)) {
        return { error: "Unsupported onboarding role. Use the dedicated super administrator invitation flow for super admins." };
      }
      if (isInstAdmin && (role !== "student" || (row.institution_id && row.institution_id !== institutionId))) {
        return { error: "Institution administrators can only onboard students into their own institution." };
      }
    }

    const results = await processCsvOnboarding(csvContent, institutionId);
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

    // The transaction authorizes the selected invitation and locks its account.
    const res = await regenerateInvitation(invitationId);
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

export async function onboardSingleUserAction(params: {
  email: string;
  name: string;
  role: string;
  institutionId?: string;
}) {
  if (!params || typeof params.email !== "string" || typeof params.name !== "string" || typeof params.role !== "string"
    || (params.institutionId !== undefined && typeof params.institutionId !== "string")) {
    return { error: "Invalid onboarding fields." };
  }
  const { email, name, role, institutionId } = params;
  const isTeacher = role === "teacher" || role === "trainer";
  if (!email || !name || !role || (!isTeacher && !institutionId)) {
    return { error: "Required fields (email, name, role, and campus if not teacher) are missing." };
  }

  try {
    const userDetails = await getCurrentUser();
    if (!userDetails) return { error: "Access denied." };

    const isSuperAdmin = userDetails.primaryRole === "super_admin";
    const isInstAdmin = role === "student" && userDetails.primaryRole === "institution_admin" && userDetails.tenantId === institutionId;

    if (!isSuperAdmin && !isInstAdmin) {
      return { error: "Access denied." };
    }

    if (!["student", "institution_admin", "teacher", "trainer", "mentor"].includes(role)) {
      return { error: "Unsupported onboarding role." };
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
    if (!isSuperAdmin && (!(userDetails.primaryRole === "teacher" || userDetails.primaryRole === "trainer") || userDetails.user?.id !== userId)) {
      return { error: "Access denied." };
    }
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
  if (!params || typeof params.email !== "string" || typeof params.name !== "string") {
    return { error: "Invalid onboarding fields." };
  }
  const { email, name } = params;
  if (!email || !name) {
    return { error: "Full Name and Email are required." };
  }

  try {
    const userDetails = await getCurrentUser();
    if (!userDetails || userDetails.primaryRole !== "super_admin") {
      return { error: "Access denied." };
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

    validateInstitutionId(userId);
    if (userId === userDetails.user.id) return { error: "You cannot delete your own account." };
    const supabase = await createClient();
    const { data, error } = await supabase.schema("core").rpc("delete_managed_user", { target_user_id: userId });
    if (error || !data) return { error: "User could not be deleted. Self/last-admin protection or account-owned files may require attention." };

    revalidatePath("/admin");
    revalidatePath("/institution");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Failed to delete user completely." };
  }
}


