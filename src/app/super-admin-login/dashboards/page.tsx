import { redirect } from "next/navigation";
import { getCurrentUser } from "@/services/auth";
import DashboardChoices from "./dashboard-choices";
import SignOutButton from "@/components/sign-out-button";

export default async function SharedDashboardsPage() {
  const current = await getCurrentUser();
  if (!current?.sharedLogin) redirect("/super-admin-login");
  return (
    <main className="min-h-screen bg-[#050810] text-slate-100 flex items-center justify-center p-6">
      <section className="w-full max-w-xl rounded-xl border border-white/10 bg-white/[0.04] p-8">
        <h1 className="text-xl font-bold">Which dashboard would you like to open?</h1>
        <p className="mt-2 text-sm text-slate-400">{current.authUser.email}</p>
        <p className="mt-1 text-sm text-slate-400">Institution: {current.institution?.name || "Unassigned"}</p>
        <DashboardChoices availableRoles={current.availableRoles || []} />
        <SignOutButton />
      </section>
    </main>
  );
}
