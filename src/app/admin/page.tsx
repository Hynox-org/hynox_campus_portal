import { getCurrentUser } from "@/services/auth";
import { listInstitutions } from "@/services/institution";
import { listOnboardingInvitations } from "@/services/onboarding";
import { redirect } from "next/navigation";
import AdminPanel from "./admin-panel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const userDetails = await getCurrentUser();

  // Route protection fallback
  if (!userDetails || userDetails.primaryRole !== "super_admin") {
    redirect("/login");
  }

  // Fetch institutions list directly (bypassing public views)
  let institutions = [];
  try {
    institutions = await listInstitutions();
  } catch (error) {
    console.error("Failed to load institutions:", error);
  }

  // Fetch invitations
  let invitations: any[] = [];
  try {
    invitations = await listOnboardingInvitations();
  } catch (error) {
    console.error("Failed to load invitations:", error);
  }

  return (
    <AdminPanel 
      adminEmail={userDetails.authUser.email} 
      initialInstitutions={institutions} 
      initialInvitations={invitations}
    />
  );
}

