import { getCurrentUser } from "@/services/auth";
import { listTeacherInstitutions } from "@/services/institution";
import { validateInstitutionId } from "@/lib/institution-validation";

export async function requireInstitutionAccess(institutionId: string, staffOnly = false) {
  validateInstitutionId(institutionId);
  const current = await getCurrentUser();
  if (!current?.user) throw new Error("Access denied.");
  const role = current.primaryRole;
  if (role === "super_admin") return current;
  const teacher = role === "teacher" || role === "trainer";
  if (role !== "institution_admin" && !teacher && (staffOnly || role !== "student")) throw new Error("Access denied.");
  if (teacher) {
    const institutions = await listTeacherInstitutions(current.user.id, false);
    if (!institutions.some(institution => institution.id === institutionId && !["inactive", "suspended"].includes(institution.status))) throw new Error("Access denied.");
  } else if (current.tenantId !== institutionId || !current.institution || ["inactive", "suspended"].includes(current.institution.status)) {
    throw new Error("Access denied.");
  }
  return current;
}
