import { redirect } from "next/navigation";
import { getCurrentUser } from "@/services/auth";

export const dynamic = "force-dynamic";

export default async function NewsletterAdminPage() {
  const session = await getCurrentUser();
  if (!session?.user || session.primaryRole !== "super_admin") redirect("/login");
  redirect("/admin?parentTab=newsletters&tab=newsletters");
}
