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
    <TeacherConsole
      teacherId={user?.id || ""}
      tenantId={resolvedTenantId}
      initialCohortId={resolvedCohortId}
      initialCohorts={cohorts}
      assignedInstitutions={assignedInstitutions}
      teacherEmail={user?.email || authUser?.email || "teacher@hynox.com"}
      teacherName={user?.full_name || "Instructor"}
    />
  );
}
