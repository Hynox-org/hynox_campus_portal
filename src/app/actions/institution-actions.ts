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
  updateInstitutionStatus
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

export async function createNewInstitutionAction(formData: FormData) {
  const name = formData.get("name") as string;
  const slug = formData.get("slug") as string;
  const code = formData.get("code") as string;
  const type = formData.get("type") as string;
  const email = formData.get("email") as string;
  const phone = formData.get("phone") as string;
  const address = formData.get("address") as string;
  const website = formData.get("website") as string;

  if (!name || !slug || !code || !type) {
    return { error: "Name, slug, code, and type are required." };
  }

  try {
    const userDetails = await getCurrentUser();
    if (!userDetails || userDetails.primaryRole !== "super_admin") {
      return { error: "Access denied. Only super administrators can perform this action." };
    }

    const institution = await createInstitution({
      name,
      slug,
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

export async function onboardSingleUserAction(params: {
  email: string;
  name: string;
  role: string;
  institutionId: string;
}) {
  const { email, name, role, institutionId } = params;
  if (!email || !name || !role || !institutionId) {
    return { error: "All fields (email, name, role, institution) are required." };
  }

  try {
    const userDetails = await getCurrentUser();
    if (!userDetails) return { error: "Access denied." };

    const isSuperAdmin = userDetails.primaryRole === "super_admin";
    const isInstAdmin = userDetails.primaryRole === "institution_admin" && userDetails.tenantId === institutionId;

    if (!isSuperAdmin && !isInstAdmin) {
      return { error: "Access denied." };
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

