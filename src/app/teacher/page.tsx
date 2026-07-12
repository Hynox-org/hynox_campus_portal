import { getCurrentUser } from "@/services/auth";
import { redirect } from "next/navigation";
import { Terminal } from "lucide-react";
import SignOutButton from "@/components/sign-out-button";
import TeacherConsole from "./teacher-console";
import { listCohorts, listEnrollments } from "@/services/delivery";
import { listAllActivities, listProjectSubmissions, listChallengeSubmissions } from "@/services/learning";
import { listTeacherInstitutions } from "@/services/institution";
import { listPrograms } from "@/services/academic";

export const dynamic = "force-dynamic";

export default async function TeacherPage() {
  const userDetails = await getCurrentUser();

  if (
    !userDetails ||
    (userDetails.primaryRole !== "teacher" && userDetails.primaryRole !== "trainer" && userDetails.primaryRole !== "super_admin")
  ) {
    redirect("/login");
  }

  const { authUser, primaryRole, user } = userDetails;

  // Resolve assigned institutions for the teacher
  let assignedInstitutions: any[] = [];
  try {
    assignedInstitutions = await listTeacherInstitutions(user.id, primaryRole === "super_admin");
  } catch (err) {
    console.error("Failed to load teacher assigned institutions:", err);
  }

  // Set initial tenant context to the first assigned institution
  const resolvedTenantId = assignedInstitutions[0]?.id || "";

  let cohorts: any[] = [];
  let activities: any[] = [];
  let projectSubmissions: any[] = [];
  let challengeSubmissions: any[] = [];
  let enrollments: any[] = [];
  let programs: any[] = [];

  if (resolvedTenantId) {
    try {
      [cohorts, activities, projectSubmissions, challengeSubmissions, enrollments, programs] = await Promise.all([
        listCohorts(resolvedTenantId),
        listAllActivities(resolvedTenantId),
        listProjectSubmissions(resolvedTenantId),
        listChallengeSubmissions(resolvedTenantId),
        listEnrollments(resolvedTenantId),
        listPrograms(resolvedTenantId, primaryRole)
      ]);
    } catch (err) {
      console.error("Failed to load teacher dashboard datasets for institution:", err);
    }
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
              <span className="text-[9px] sm:text-[10px] text-[#475569] font-medium tracking-wide">INSTRUCTOR CONSOLE</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 text-xs">
            <span className="hidden sm:inline-block px-2 py-0.5 rounded-full font-bold border bg-[#2563EB]/10 text-[#2563EB] border-[#2563EB]/20 text-[10px] capitalize">
              {primaryRole}
            </span>
            
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 flex-1 w-full">
        <TeacherConsole
          teacherId={user?.id || ""}
          tenantId={resolvedTenantId}
          initialCohorts={cohorts}
          initialActivities={activities}
          initialProjectSubmissions={projectSubmissions}
          initialChallengeSubmissions={challengeSubmissions}
          initialEnrollments={enrollments}
          assignedInstitutions={assignedInstitutions}
          initialPrograms={programs}
        />
      </main>
    </div>
  );
}
