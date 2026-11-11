import { getCurrentUser } from "@/services/auth";
import { redirect } from "next/navigation";
import StudentConsole from "./student-console";

export const dynamic = "force-dynamic";

export default async function StudentPage() {
  const userDetails = await getCurrentUser(true);

  if (!userDetails || userDetails.primaryRole !== "student") {
    redirect("/login");
  }

  const { authUser, primaryRole, institution } = userDetails;

  return (
    <StudentConsole
      studentEmail={(authUser.email ?? "")}
      fullName={userDetails.user.full_name || "Student"}
      primaryRole={primaryRole}
      institution={institution}
      studentId={userDetails.user.id}
    />
  );
}
