import { getCurrentUser } from "@/services/auth";
import { redirect } from "next/navigation";
import { Terminal } from "lucide-react";
import SignOutButton from "@/components/sign-out-button";
import TeacherConsole from "./teacher-console";
import { listTeacherCohorts, listCohortEnrollments, listCohortCourseAssignments } from "@/services/delivery";
import { listCohortActivities, listCohortProjectSubmissions, listCohortChallengeSubmissions } from "@/services/learning";

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

  let cohorts: any[] = [];
  try {
    cohorts = await listTeacherCohorts(user.id, primaryRole === "super_admin");
  } catch (err) {
    console.error("Failed to load teacher assigned cohorts:", err);
  }

  // Set initial cohort ID to the first assigned cohort
  const resolvedCohortId = cohorts[0]?.id || "";
  const resolvedTenantId = cohorts[0]?.tenant_id || "";

  // Derive assigned institutions from the teacher's cohorts
  const instMap = new Map<string, any>();
  cohorts.forEach(c => {
    if (c.institution) {
      instMap.set(c.institution.id, c.institution);
    }
  });
  const assignedInstitutions = Array.from(instMap.values());

  return (
    <div className="min-h-screen bg-[#0B0C0F] flex flex-col text-[#EDEFF5] font-sans">
      <header className="bg-[#131418] border-b border-[#23252C] shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-[#6E79F4]/10 text-[#6E79F4] p-2 rounded-xl border border-[#6E79F4]/20">
              <Terminal size={18} />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-xs sm:text-sm tracking-tight">Hynox Campus Portal</span>
              <span className="text-[9px] sm:text-[10px] text-[#C2C6D1] font-medium tracking-wide">INSTRUCTOR CONSOLE</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 text-xs">
            <span className="hidden sm:inline-block px-2 py-0.5 rounded-full font-bold border bg-[#6E79F4]/10 text-[#6E79F4] border-[#6E79F4]/20 text-[10px] capitalize">
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
          initialCohortId={resolvedCohortId}
          initialCohorts={cohorts}
          assignedInstitutions={assignedInstitutions}
        />
      </main>
    </div>
  );
}
