import { createClient } from "@/utils/supabase/server";
import { sendOnboardingEmail } from "@/utils/email";

export interface OnboardingResult {
  email: string;
  status: "success" | "error";
  link?: string;
  error?: string;
}

export function parseCsv(csvContent: string) {
  const lines = csvContent.split(/\r?\n/);
  const result: Array<{ name: string; email: string; role: string; institution_id?: string }> = [];

  if (lines.length === 0) return result;

  const cleanVal = (val: string) => {
    let trimmed = val.trim();
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      trimmed = trimmed.substring(1, trimmed.length - 1);
    }
    return trimmed;
  };

  // Read headers to map columns
  const headers = lines[0].split(",").map((h) => cleanVal(h).toLowerCase());
  const nameIdx = headers.findIndex(h => h.includes("name"));
  const emailIdx = headers.findIndex(h => h.includes("email") || h.includes("mail"));
  const roleIdx = headers.findIndex(h => h.includes("role"));
  const instIdx = headers.findIndex(h => h.includes("institution_id") || h.includes("institution"));

  if (nameIdx === -1 || emailIdx === -1) {
    throw new Error("CSV must contain 'Name' and 'Email' headers.");
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const columns = line.split(",").map((c) => cleanVal(c));
    if (columns.length < 2) continue;

    result.push({
      name: columns[nameIdx],
      email: columns[emailIdx],
      role: roleIdx !== -1 && columns[roleIdx] ? columns[roleIdx] : "student",
      institution_id: instIdx !== -1 && columns[instIdx] ? columns[instIdx] : undefined,
    });
  }

  return result;
}

export async function processCsvOnboarding(
  csvContent: string,
  selectedInstitutionId: string,
  invitedByUserId: string
): Promise<OnboardingResult[]> {
  const supabase = await createClient();
  const parsedRows = parseCsv(csvContent);
  const results: OnboardingResult[] = [];

  // Fetch all roles to map names to IDs
  const { data: rolesList } = await supabase
    .schema("core")
    .from("roles")
    .select("id, name");

  const rolesMap = new Map(rolesList?.map((r) => [r.name.toLowerCase(), r.id]));

  // Fetch institutions to map name
  const { data: insts } = await supabase
    .schema("institution")
    .from("institutions")
    .select("id, name");
  const instMap = new Map(insts?.map((i) => [i.id, i.name]));

  for (const row of parsedRows) {
    try {
      const email = row.email;
      const name = row.name;
      const roleName = (row.role || "student").toLowerCase();
      const institutionId = row.institution_id || selectedInstitutionId;

      if (!email || !name || !roleName || !institutionId) {
        throw new Error("Missing required fields (name, email, or institution_id)");
      }

      const roleId = rolesMap.get(roleName);
      if (!roleId) {
        throw new Error(
          `Invalid role: '${row.role}'. Allowed: super_admin, institution_admin, teacher, trainer, mentor, student, public.`
        );
      }

      // Check if user already exists
      const { data: existingUser } = await supabase
        .schema("core")
        .from("users")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      let userId = existingUser?.id;

      if (!userId) {
        // Create pre-provisioned user in core.users
        const { data: newUser, error: userError } = await supabase
          .schema("core")
          .from("users")
          .insert({
            full_name: name,
            email: email,
            tenant_id: institutionId,
            status: "invited",
            onboarding_source: "excel_import",
          })
          .select("id")
          .single();

        if (userError) throw userError;
        userId = newUser.id;

        // Assign core.user_roles role map
        const { error: roleLinkError } = await supabase
          .schema("core")
          .from("user_roles")
          .insert({
            user_id: userId,
            role_id: roleId,
          });

        if (roleLinkError) throw roleLinkError;
      } else {
        // If user already exists in core.users, update their tenant_id
        await supabase
          .schema("core")
          .from("users")
          .update({ tenant_id: institutionId })
          .eq("id", userId);
      }

      // Determine invitation type
      let invitationType = "student_onboarding";
      if (roleName === "institution_admin") {
        invitationType = "institution_admin_invite";
      } else if (roleName === "teacher" || roleName === "trainer") {
        invitationType = "trainer_onboarding";
      } else if (roleName === "mentor") {
        invitationType = "mentor_invite";
      }

      // Create onboarding invitation token record
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days expiry
      const token = crypto.randomUUID();

      const { error: inviteError } = await supabase
        .schema("core")
        .from("user_invitations")
        .insert({
          user_id: userId,
          tenant_id: institutionId,
          token: token,
          invited_by: invitedByUserId,
          expires_at: expiresAt,
          status: "created",
          invitation_type: invitationType,
        });

      if (inviteError) throw inviteError;

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const link = `${appUrl}/onboarding/verify?token=${token}&email=${encodeURIComponent(email)}`;

      // Send automated email notification
      const roleNameMap: Record<string, string> = {
        student_onboarding: "Student",
        trainer_onboarding: "Teacher / Trainer",
        institution_admin_invite: "Institution Admin",
        mentor_invite: "Mentor",
      };
      const roleLabel = roleNameMap[invitationType] || "Member";
      const institutionName = instMap.get(institutionId) || "Hynox Campus";

      let mailStatus = "sent";
      try {
        await sendOnboardingEmail(email, link, name, roleLabel, institutionName);
      } catch (mailErr: any) {
        console.error("Onboarding email dispatch failed:", mailErr);
        mailStatus = "failed";
      }

      // Update dispatch status in database
      await supabase
        .schema("core")
        .from("user_invitations")
        .update({ status: mailStatus })
        .eq("token", token);

      results.push({ email, status: "success", link });
    } catch (err: any) {
      results.push({
        email: row.email || "unknown",
        status: "error",
        error: err.message,
      });
    }
  }

  return results;
}

export async function verifyInvitation(token: string, email: string) {
  const supabase = await createClient();

  const { data: invitation, error } = await supabase
    .schema("core")
    .from("user_invitations")
    .select(`
      id,
      token,
      expires_at,
      status,
      invitation_type,
      user:user_id (
        id,
        full_name,
        email,
        tenant_id
      )
    `)
    .eq("token", token)
    .maybeSingle();

  if (error || !invitation) {
    return { valid: false, error: "Invitation not found or invalid token." };
  }

  const user = invitation.user as any;
  if (!user || user.email.toLowerCase() !== email.toLowerCase()) {
    return { valid: false, error: "Invitation email mismatch." };
  }

  if (
    invitation.status !== "pending" &&
    invitation.status !== "created" &&
    invitation.status !== "sent"
  ) {
    return { valid: false, error: `Invitation has already been ${invitation.status}.` };
  }

  if (new Date(invitation.expires_at) < new Date()) {
    // Update invitation status to expired
    await supabase
      .schema("core")
      .from("user_invitations")
      .update({ status: "expired" })
      .eq("id", invitation.id);

    return { valid: false, error: "Invitation token has expired." };
  }

  // Fetch institution name
  let institutionName = "Hynox Campus";
  if (user.tenant_id) {
    const { data: inst } = await supabase
      .schema("institution")
      .from("institutions")
      .select("name")
      .eq("id", user.tenant_id)
      .maybeSingle();

    if (inst) {
      institutionName = inst.name;
    }
  }

  return {
    valid: true,
    invitation: {
      id: invitation.id,
      token: invitation.token,
      invitationType: invitation.invitation_type,
      fullName: user.full_name,
      email: user.email,
      institutionName,
    },
  };
}

export async function listOnboardingInvitations() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("core")
    .from("user_invitations")
    .select(`
      id,
      token,
      expires_at,
      accepted_at,
      status,
      invitation_type,
      created_at,
      tenant_id,
      user:user_id (
        id,
        full_name,
        email,
        status
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  // Fetch institutions to map tenant_id to name
  const { data: insts } = await supabase
    .schema("institution")
    .from("institutions")
    .select("id, name");
  
  const instMap = new Map(insts?.map((i) => [i.id, i.name]));

  return (data || []).map((inv: any) => ({
    ...inv,
    institution_name: inv.tenant_id ? (instMap.get(inv.tenant_id) || "Unknown Institution") : "Global / Platform",
  }));
}

export async function regenerateInvitation(invitationId: string, invitedByUserId: string) {
  const supabase = await createClient();

  // 1. Fetch current invitation to check it exists and get email/tenant_id
  const { data: invitation, error: fetchError } = await supabase
    .schema("core")
    .from("user_invitations")
    .select(`
      id,
      tenant_id,
      invitation_type,
      user:user_id (
        id,
        full_name,
        email
      )
    `)
    .eq("id", invitationId)
    .maybeSingle();

  if (fetchError || !invitation) {
    throw new Error(fetchError?.message || "Invitation not found.");
  }

  const user = invitation.user as any;
  if (!user) {
    throw new Error("Associated user not found for this invitation.");
  }

  // 2. Generate new token, expires_at (7 days) and reset status to 'created'
  const newToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: updated, error: updateError } = await supabase
    .schema("core")
    .from("user_invitations")
    .update({
      token: newToken,
      expires_at: expiresAt,
      status: "created",
      invited_by: invitedByUserId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invitationId)
    .select("*")
    .single();

  if (updateError) {
    throw updateError;
  }

  // Also update user status in core.users back to 'invited'
  await supabase
    .schema("core")
    .from("users")
    .update({ status: "invited" })
    .eq("id", user.id);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const link = `${appUrl}/onboarding/verify?token=${newToken}&email=${encodeURIComponent(user.email)}`;

  // Resolve roles and name
  const roleNameMap: Record<string, string> = {
    student_onboarding: "Student",
    trainer_onboarding: "Teacher / Trainer",
    institution_admin_invite: "Institution Admin",
    mentor_invite: "Mentor",
    super_admin_invite: "Super Administrator",
  };
  const roleLabel = roleNameMap[invitation.invitation_type] || "Member";

  // Fetch institution name
  let institutionName = "Hynox Campus";
  if (invitation.tenant_id) {
    const { data: inst } = await supabase
      .schema("institution")
      .from("institutions")
      .select("name")
      .eq("id", invitation.tenant_id)
      .maybeSingle();
    if (inst) {
      institutionName = inst.name;
    }
  }

  let mailStatus = "sent";
  try {
    await sendOnboardingEmail(user.email, link, user.full_name || "Member", roleLabel, institutionName);
  } catch (mailErr: any) {
    console.error("Regenerate email dispatch failed:", mailErr);
    mailStatus = "failed";
  }

  // Update status in database
  const { data: finalUpdated } = await supabase
    .schema("core")
    .from("user_invitations")
    .update({ status: mailStatus })
    .eq("id", invitationId)
    .select("*")
    .single();

  return {
    ...(finalUpdated || updated),
    link,
    email: user.email,
  };
}

export async function onboardSingleUser(params: {
  email: string;
  name: string;
  role: string;
  institutionId: string;
  invitedByUserId: string;
}): Promise<OnboardingResult> {
  const supabase = await createClient();
  const { email, name, role, institutionId, invitedByUserId } = params;

  try {
    if (!email || !name || !role || !institutionId) {
      throw new Error("Missing required fields (name, email, role, or institutionId)");
    }

    // Fetch all roles to map names to IDs
    const { data: rolesList } = await supabase
      .schema("core")
      .from("roles")
      .select("id, name");

    const rolesMap = new Map(rolesList?.map((r) => [r.name.toLowerCase(), r.id]));
    const roleName = role.toLowerCase();
    const roleId = rolesMap.get(roleName);
    if (!roleId) {
      throw new Error(
        `Invalid role: '${role}'. Allowed: super_admin, institution_admin, teacher, trainer, mentor, student, public.`
      );
    }

    // Fetch institution name
    const { data: inst } = await supabase
      .schema("institution")
      .from("institutions")
      .select("name")
      .eq("id", institutionId)
      .maybeSingle();

    // Check if user already exists
    const { data: existingUser } = await supabase
      .schema("core")
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    let userId = existingUser?.id;

    if (!userId) {
      // Create pre-provisioned user in core.users
      const { data: newUser, error: userError } = await supabase
        .schema("core")
        .from("users")
        .insert({
          full_name: name,
          email: email,
          tenant_id: institutionId,
          status: "invited",
          onboarding_source: "excel_import",
        })
        .select("id")
        .single();

      if (userError) throw userError;
      userId = newUser.id;

      // Assign core.user_roles role map
      const { error: roleLinkError } = await supabase
        .schema("core")
        .from("user_roles")
        .insert({
          user_id: userId,
          role_id: roleId,
        });

      if (roleLinkError) throw roleLinkError;
    } else {
      // If user already exists in core.users, update their tenant_id
      await supabase
        .schema("core")
        .from("users")
        .update({ tenant_id: institutionId })
        .eq("id", userId);
    }

    // Determine invitation type
    let invitationType = "student_onboarding";
    if (roleName === "institution_admin") {
      invitationType = "institution_admin_invite";
    } else if (roleName === "teacher" || roleName === "trainer") {
      invitationType = "trainer_onboarding";
    } else if (roleName === "mentor") {
      invitationType = "mentor_invite";
    }

    // Create onboarding invitation token record
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days expiry
    const token = crypto.randomUUID();

    const { error: inviteError } = await supabase
      .schema("core")
      .from("user_invitations")
      .insert({
        user_id: userId,
        tenant_id: institutionId,
        token: token,
        invited_by: invitedByUserId,
        expires_at: expiresAt,
        status: "created",
        invitation_type: invitationType,
      });

    if (inviteError) throw inviteError;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const link = `${appUrl}/onboarding/verify?token=${token}&email=${encodeURIComponent(email)}`;

    // Send automated email notification
    const roleNameMap: Record<string, string> = {
      student_onboarding: "Student",
      trainer_onboarding: "Teacher / Trainer",
      institution_admin_invite: "Institution Admin",
      mentor_invite: "Mentor",
    };
    const roleLabel = roleNameMap[invitationType] || "Member";
    const institutionName = inst?.name || "Hynox Campus";

    let mailStatus = "sent";
    try {
      await sendOnboardingEmail(email, link, name, roleLabel, institutionName);
    } catch (mailErr: any) {
      console.error("Onboarding email dispatch failed:", mailErr);
      mailStatus = "failed";
    }

    // Update dispatch status in database
    await supabase
      .schema("core")
      .from("user_invitations")
      .update({ status: mailStatus })
      .eq("token", token);

    return { email, status: "success", link };
  } catch (err: any) {
    return {
      email: email || "unknown",
      status: "error",
      error: err.message,
    };
  }
}

export async function onboardSuperAdmin(params: {
  email: string;
  name: string;
  invitedByUserId: string;
}): Promise<OnboardingResult> {
  const supabase = await createClient();
  const { email, name, invitedByUserId } = params;

  try {
    if (!email || !name) {
      throw new Error("Missing required fields (name, email)");
    }

    // Fetch all roles to map name to ID
    const { data: rolesList } = await supabase
      .schema("core")
      .from("roles")
      .select("id, name");

    const rolesMap = new Map(rolesList?.map((r) => [r.name.toLowerCase(), r.id]));
    const roleId = rolesMap.get("super_admin");
    if (!roleId) {
      throw new Error("Super Admin role not found in database.");
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .schema("core")
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    let userId = existingUser?.id;

    if (!userId) {
      // Create pre-provisioned user in core.users
      const { data: newUser, error: userError } = await supabase
        .schema("core")
        .from("users")
        .insert({
          full_name: name,
          email: email,
          tenant_id: null,
          status: "invited",
          onboarding_source: "admin_created",
        })
        .select("id")
        .single();

      if (userError) throw userError;
      userId = newUser.id;

      // Assign core.user_roles role map
      const { error: roleLinkError } = await supabase
        .schema("core")
        .from("user_roles")
        .insert({
          user_id: userId,
          role_id: roleId,
        });

      if (roleLinkError) throw roleLinkError;
    } else {
      // Check if user already has the super_admin role
      const { data: existingRoleLink } = await supabase
        .schema("core")
        .from("user_roles")
        .select("user_id")
        .eq("user_id", userId)
        .eq("role_id", roleId)
        .maybeSingle();

      if (!existingRoleLink) {
        const { error: roleLinkError } = await supabase
          .schema("core")
          .from("user_roles")
          .insert({
            user_id: userId,
            role_id: roleId,
          });
        if (roleLinkError) throw roleLinkError;
      }

      // We also set tenant_id to null since they are super_admin now
      await supabase
        .schema("core")
        .from("users")
        .update({ tenant_id: null })
        .eq("id", userId);
    }

    // Determine invitation type
    const invitationType = "super_admin_invite";

    // Create onboarding invitation token record
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days expiry
    const token = crypto.randomUUID();

    const { error: inviteError } = await supabase
      .schema("core")
      .from("user_invitations")
      .insert({
        user_id: userId,
        tenant_id: null,
        token: token,
        invited_by: invitedByUserId,
        expires_at: expiresAt,
        status: "created",
        invitation_type: invitationType,
      });

    if (inviteError) throw inviteError;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const link = `${appUrl}/onboarding/verify?token=${token}&email=${encodeURIComponent(email)}`;

    // Send automated email notification
    let mailStatus = "sent";
    try {
      await sendOnboardingEmail(email, link, name, "Super Administrator", "Hynox Campus");
    } catch (mailErr: any) {
      console.error("Onboarding email dispatch failed:", mailErr);
      mailStatus = "failed";
    }

    // Update dispatch status in database
    await supabase
      .schema("core")
      .from("user_invitations")
      .update({ status: mailStatus })
      .eq("token", token);

    return { email, status: "success", link };
  } catch (err: any) {
    return {
      email: email || "unknown",
      status: "error",
      error: err.message,
    };
  }
}


