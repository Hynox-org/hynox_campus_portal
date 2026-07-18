import { getCurrentUser } from "@/services/auth";
import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import SignOutButton from "@/components/sign-out-button";
import InstitutionPanel from "./institution-panel";

export const dynamic = "force-dynamic";

export default async function InstitutionAdminPage() {
  const userDetails = await getCurrentUser();

  if (!userDetails || userDetails.primaryRole !== "institution_admin") {
    redirect("/login");
  }

  const { authUser, primaryRole, institution, tenantId } = userDetails;

  if (!institution || !tenantId) {
    redirect("/login");
  }

  if (institution.status === "inactive" || institution.status === "suspended") {
    return (
      <div className="min-h-screen bg-[#0B0C0F] flex items-center justify-center p-6 text-[#EDEFF5] font-sans">
        <div className="bg-[#131418] border border-[#23252C] p-8 rounded-2xl shadow-card max-w-2xl w-full text-center space-y-6 animate-pageIn">
          <div className="mx-auto w-16 h-16 bg-[#F0555D]/10 text-[#F0555D] rounded-full flex items-center justify-center border border-[#F0555D]/20">
            <AlertTriangle size={32} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-[#EDEFF5]">Campus Dashboard Locked</h2>
            <p className="text-sm text-[#C2C6D1]">
              The institution <strong className="text-[#EDEFF5]">{institution.name}</strong> is currently deactivated or suspended.
            </p>
            <p className="text-xs text-[#C2C6D1] leading-relaxed">
              All administrator options, onboarding links, and class cohort controls have been disabled for this campus. Please contact platform super administrators for billing or account reinstatement queries.
            </p>
          </div>
          <div className="flex justify-center">
            <SignOutButton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <InstitutionPanel
      adminEmail={authUser.email}
      institution={institution}
      tenantId={tenantId}
      primaryRole={primaryRole}
    />
  );
}
