import { getCurrentUser } from "@/services/auth";
import { listOnboardingInvitations } from "@/services/onboarding";
import { listPrograms, getAcademicLookups, listTenantInstructors, listTenantCourses } from "@/services/academic";
import { redirect } from "next/navigation";
import { Terminal, AlertTriangle } from "lucide-react";
import SignOutButton from "@/components/sign-out-button";
import InstitutionPanel from "./institution-panel";
import { listCohorts, listEnrollments } from "@/services/delivery";
import { listProjectSubmissions, listChallengeSubmissions, listAllActivities } from "@/services/learning";
import { listQuizAttemptsAction } from "@/app/actions/learning-actions";

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

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col text-[#0F172A] font-sans">
      <header className="bg-white border-b border-[#E2E8F0] shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-[#2563EB]/10 text-[#2563EB] p-2 rounded-xl border border-[#2563EB]/20">
              <Terminal size={18} />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xs sm:text-sm tracking-tight">Hynox Campus Portal</span>
              <span className="text-[9px] sm:text-[10px] text-[#475569] font-medium tracking-wide">CAMPUS DASHBOARD</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 text-xs">
            <span className="hidden sm:inline text-[#475569] font-medium">
              Campus: <strong className="text-[#0F172A] font-bold">{institution.name}</strong>
            </span>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded-full font-bold border bg-[#2563EB]/10 text-[#2563EB] border-[#2563EB]/20 text-[10px] capitalize">
              {primaryRole}
            </span>
            
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 flex-1 w-full">
        {institution.status === "inactive" || institution.status === "suspended" ? (
          <div className="bg-white border border-[#E2E8F0] p-8 rounded-2xl shadow-sm max-w-2xl mx-auto text-center space-y-6 mt-10">
            <div className="mx-auto w-16 h-16 bg-[#DC2626]/10 text-[#DC2626] rounded-full flex items-center justify-center border border-[#DC2626]/20">
              <AlertTriangle size={32} />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-[#0F172A]">Campus Dashboard Locked</h2>
              <p className="text-sm text-[#475569]">
                The institution <strong className="text-[#0F172A]">{institution.name}</strong> is currently deactivated or suspended.
              </p>
              <p className="text-xs text-[#64748B] leading-relaxed">
                All administrator options, onboarding links, and class cohort controls have been disabled for this campus. Please contact platform super administrators for billing or account reinstatement queries.
              </p>
            </div>
          </div>
        ) : (
          <InstitutionPanel 
            adminEmail={authUser.email} 
            institution={institution}
            tenantId={tenantId}
            primaryRole={primaryRole}
          />
        )}
      </main>
    </div>
  );
}
