import { getCurrentUser } from "@/services/auth";
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


// Bulk provisioning is bounded to 2500 users; email delivery runs outside this request.
export const maxDuration = 120;
