import { redirect } from "next/navigation";
import { getCurrentUser } from "@/services/auth";

export const dynamic = "force-dynamic";

export default async function StudentNewsletterPage() {
  const session = await getCurrentUser();
  if (!session?.user || session.primaryRole !== "student") redirect("/login");
  redirect("/student?parentTab=newsletters&tab=newsletters");
}
