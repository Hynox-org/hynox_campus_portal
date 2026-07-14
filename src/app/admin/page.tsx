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

  return (
    <AdminPanel 
      adminEmail={userDetails.authUser.email} 
    />
  );
}

