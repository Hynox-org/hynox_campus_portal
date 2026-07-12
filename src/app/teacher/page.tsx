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

  let activities: any[] = [];
  let projectSubmissions: any[] = [];
  let challengeSubmissions: any[] = [];
  let enrollments: any[] = [];
  let programs: any[] = [];

  if (resolvedCohortId) {
    try {
      [activities, projectSubmissions, challengeSubmissions, enrollments, programs] = await Promise.all([
        listCohortActivities(resolvedCohortId),
        listCohortProjectSubmissions(resolvedCohortId),
        listCohortChallengeSubmissions(resolvedCohortId),
        listCohortEnrollments(resolvedCohortId),
        listCohortCourseAssignments(resolvedCohortId).then(list => list.map(l => l.course).filter(Boolean))
      ]);
    } catch (err) {
      console.error("Failed to load teacher dashboard datasets for cohort:", err);
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
          initialCohortId={resolvedCohortId}
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
