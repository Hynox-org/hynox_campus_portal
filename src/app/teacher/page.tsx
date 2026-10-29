import { getCurrentUser } from "@/services/auth";
import { redirect } from "next/navigation";
import TeacherConsole from "./teacher-console";
import { listTeacherCohorts } from "@/services/delivery";
import { listTeacherInstitutions } from "@/services/institution";

export const dynamic = "force-dynamic";

export default async function TeacherPage() {
  const userDetails = await getCurrentUser(true);

  if (
    !userDetails ||
    (userDetails.primaryRole !== "teacher" && userDetails.primaryRole !== "trainer" && userDetails.primaryRole !== "super_admin")
  ) {
    redirect("/login");
  }

  const { authUser, primaryRole, user } = userDetails;

  const [cohorts, assignedInstitutions] = await Promise.all([
    listTeacherCohorts(user.id, primaryRole === "super_admin"),
    listTeacherInstitutions(user.id, primaryRole === "super_admin"),
  ]);
  const resolvedCohortId = cohorts[0]?.id || "";
  const resolvedTenantId = cohorts[0]?.tenant_id || assignedInstitutions[0]?.id || "";

  return (
    <TeacherConsole
      teacherId={user?.id || ""}
      tenantId={resolvedTenantId}
      initialCohortId={resolvedCohortId}
      initialCohorts={cohorts}
      assignedInstitutions={assignedInstitutions}
      teacherEmail={user?.email || authUser?.email || "teacher@hynox.com"}
      teacherName={user?.full_name || "Instructor"}
      primaryRole={primaryRole}
    />
  );
}
