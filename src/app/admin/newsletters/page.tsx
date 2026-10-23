import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/services/auth";
import NewsletterAdminPanel from "@/features/newsletter/admin-panel";

export const dynamic = "force-dynamic";

export default async function NewsletterAdminPage() {
  const session = await getCurrentUser();
  if (!session?.user || session.primaryRole !== "super_admin") redirect("/login");
  return <main className="min-h-screen px-5 py-8"><div className="mx-auto max-w-5xl space-y-8"><Link href="/admin" className="text-sm text-[#A5B4FC]">← Admin dashboard</Link><NewsletterAdminPanel /></div></main>;
}
