import { getCurrentUser } from "@/services/auth";
import { signOutAction } from "@/app/actions/auth-actions";
import { redirect } from "next/navigation";
import { Terminal, LogOut, Info, ShieldAlert } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PublicPage() {
  const userDetails = await getCurrentUser();

  // Also allow mentors to share this dashboard placeholder
  if (
    !userDetails ||
    (userDetails.primaryRole !== "public" && userDetails.primaryRole !== "mentor")
  ) {
    redirect("/login");
  }

  const { authUser, primaryRole } = userDetails;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col text-[#0F172A] font-sans">
      <header className="bg-white border-b border-[#E2E8F0] shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-[#2563EB]/10 text-[#2563EB] p-2 rounded-xl border border-[#2563EB]/20">
              <Terminal size={18} />
            </div>
            <span className="font-bold text-sm tracking-tight">Hynox Campus Portal</span>
          </div>

          <form action={signOutAction}>
            <button
              type="submit"
              className="flex items-center gap-1.5 bg-[#DC2626]/10 text-[#DC2626] border border-[#DC2626]/20 px-3 py-1.5 rounded-lg hover:bg-[#DC2626] hover:text-white transition-all text-xs font-semibold"
            >
              <LogOut size={13} />
              Sign Out
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 flex-1 w-full space-y-6">
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-[#475569]/10 text-[#475569] p-2.5 rounded-xl border border-[#475569]/20">
              <Info size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold">Public Account Hub</h2>
              <p className="text-xs text-[#475569]">Awaiting invitation or onboarding tokens</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-5 mb-6">
            <div>
              <span className="text-[10px] font-bold text-[#475569] block uppercase tracking-wide">User Email</span>
              <span className="font-semibold">{authUser.email}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#475569] block uppercase tracking-wide">Resolved RBAC Role</span>
              <span className="font-semibold inline-flex px-2 py-0.5 rounded bg-[#475569]/15 text-[#475569] font-bold mt-1 text-[10px]">
                {primaryRole}
              </span>
            </div>
          </div>

          <div className="bg-[#F59E0B]/5 border border-[#F59E0B]/20 text-[#0F172A] rounded-xl p-5 text-xs flex items-start gap-2.5 leading-relaxed">
            <ShieldAlert className="text-[#F59E0B] shrink-0 mt-0.5" size={16} />
            <div>
              <span className="font-bold block mb-1">Onboarding Required</span>
              <span>
                Your email is registered with a `public` account role. You do not have permissions to access private campus classrooms. 
                If you have been issued an activation token (e.g. `HYN-XXX-XX`) by your professor or department admin, please claim it 
                in the login panel to activate your student/teacher dashboard.
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
